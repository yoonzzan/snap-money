import React, { useState, useRef, ChangeEvent, useEffect } from 'react';
import { GoogleGenAI, Type } from '@google/genai';
import { DEFAULT_EXCHANGE_RATE } from './constants';

type Mode = 'manual' | 'photo';
type Theme = 'light' | 'dark';

// Utility to convert file to base64
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = (error) => reject(error);
  });
};

const App: React.FC = () => {
  const [mode, setMode] = useState<Mode>('manual');
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      const stored = localStorage.getItem('theme');
      if (stored === 'light' || stored === 'dark') return stored;
      return 'dark';
    } catch {
      return 'dark';
    }
  });
  
  // Manual mode state
  const [manualInput, setManualInput] = useState<string>('');
  const [manualResult, setManualResult] = useState<string>('');

  // Photo mode state
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [photoResults, setPhotoResults] = useState<{ original: number; converted: number }[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Editable exchange rate
  const [exchangeRate, setExchangeRate] = useState<number>(DEFAULT_EXCHANGE_RATE);

  useEffect(() => {
    const root = window.document.documentElement;
    const isDark = theme === 'dark';
    
    root.classList.remove(isDark ? 'light' : 'dark');
    root.classList.add(theme);

    // Save theme to localStorage
    localStorage.setItem('theme', theme);
  }, [theme]);

  // 환율 변경 시 수동 입력 결과 재계산
  useEffect(() => {
    if (manualInput) {
      const amount = parseFloat(manualInput);
      if (!isNaN(amount) && amount >= 0) {
        setManualResult((amount * exchangeRate).toLocaleString('ko-KR', { maximumFractionDigits: 2 }));
      }
    }
  }, [exchangeRate, manualInput]);

  // 환율 변경 시 사진 변환 결과 재계산
  useEffect(() => {
    if (photoResults.length > 0) {
      const updatedResults = photoResults.map(result => ({
        original: result.original,
        converted: result.original * exchangeRate,
      }));
      setPhotoResults(updatedResults);
    }
  }, [exchangeRate]);

  const toggleTheme = () => {
    setTheme(prevTheme => (prevTheme === 'light' ? 'dark' : 'light'));
  };

  const handleManualInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setManualInput(value);
    const amount = parseFloat(value);
    if (!isNaN(amount) && amount >= 0) {
      setManualResult((amount * exchangeRate).toLocaleString('ko-KR', { maximumFractionDigits: 2 }));
    } else {
      setManualResult('');
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const previewUrl = URL.createObjectURL(file);
      setImagePreview(previewUrl);
      setError('');
      setPhotoResults([]);
    }
  };
  
  const triggerFileSelect = () => fileInputRef.current?.click();

  const handleDetectAndConvert = async () => {
    if (!imageFile) {
      setError('먼저 사진을 선택해주세요.');
      return;
    }

    setIsLoading(true);
    setError('');
    setPhotoResults([]);

    try {
      const base64Image = await fileToBase64(imageFile);
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
      if (!apiKey) {
        throw new Error('Missing VITE_GEMINI_API_KEY');
      }
      const ai = new GoogleGenAI({ apiKey });

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: {
          parts: [
            { inlineData: { mimeType: imageFile.type, data: base64Image } },
            { text: 'From the image, extract all distinct numerical values that could represent prices in Thai Baht. Ignore any numbers that are clearly not prices (like dates, times, quantities). Return only a JSON array of numbers.' },
          ],
        },
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: { type: Type.NUMBER },
          },
        },
      });

      const detectedAmounts = JSON.parse(response.text || '[]') as number[];

      if (detectedAmounts.length === 0) {
        setError('사진에서 금액을 감지하지 못했습니다. 다른 사진으로 시도해보세요.');
      } else {
        const results = detectedAmounts.map(amount => ({
          original: amount,
          converted: amount * exchangeRate,
        }));
        setPhotoResults(results);
      }
    } catch (err) {
      console.error(err);
      let errorMessage = '금액 감지 중 오류가 발생했습니다.';
      if (err instanceof Error) {
        // API 키 관련 에러를 대소문자 구분 없이 감지
        const message = err.message || '';
        if (/api\s*key/i.test(message)) {
          errorMessage = 'API 키가 없거나 유효하지 않습니다. .env.local에 VITE_GEMINI_API_KEY를 올바르게 설정한 후 개발 서버를 재시작해주세요.';
        } else {
          errorMessage += `: ${message}`;
        }
      }
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-slate-50 dark:bg-slate-900 bg-radial-soft min-h-screen text-gray-800 dark:text-white flex flex-col items-center p-4 sm:p-6 lg:p-8 font-sans transition-colors duration-300">
      <div className="mx-auto w-full max-w-md md:max-w-lg">
        <header className="relative text-center mb-6 md:mb-8 animate-fade-in">
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight leading-tight text-slate-900 dark:text-white drop-shadow-md">Snap Money</h1>
          <p className="text-base text-slate-500 dark:text-slate-400 mt-2">태국 바트(THB) 🇹🇭 → 대한민국 원(KRW) 🇰🇷</p>
          <button 
            onClick={toggleTheme} 
            className="absolute -top-1 -right-1 sm:top-0 sm:right-0 p-2 rounded-full transition-colors duration-300 bg-white/70 dark:bg-slate-800/60 backdrop-blur border border-white/40 dark:border-white/10 hover:bg-white/90 dark:hover:bg-slate-700"
            aria-label="Toggle theme"
          >
            {theme === 'light' ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m8.66-15.66l-.707.707M4.04 19.96l-.707.707M21 12h-1M4 12H3m15.66 8.66l-.707-.707M4.04 4.04l-.707-.707" /></svg>
            )}
          </button>
        </header>

        <main className="glass rounded-3xl p-6">
          <div className="flex border-b border-gray-200/60 dark:border-slate-700/60 mb-6">
            <button
              onClick={() => setMode('manual')}              
              className={`tab ${mode === 'manual' ? 'bg-brand-500 text-white' : 'bg-white/60 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-brand-50'}`}
            >
              바트 금액 직접 입력
            </button>
            <button
              onClick={() => setMode('photo')}
              className={`tab ${mode === 'photo' ? 'bg-brand-500 text-white' : 'bg-white/60 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-brand-50'}`}
            >
              사진으로 금액 변환
            </button>
          </div>

          {mode === 'manual' && (
            <div id="manual-converter" className="animate-fade-in">
              <label htmlFor="thb-input" className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                바트(THB) 금액
              </label>
              <input
                type="number"
                id="thb-input"
                value={manualInput}
                onChange={handleManualInputChange}
                placeholder="예: 1200"
                className="w-full p-3 rounded-xl transition-shadow bg-slate-100 border border-slate-300 text-gray-800 placeholder-slate-400 focus:ring-2 focus:ring-brand-500 focus:outline-none dark:bg-slate-700 dark:border-slate-600 dark:text-white dark:placeholder-slate-500 dark:focus:ring-brand-500 text-lg"
              />
              {manualResult && (
                <div className="mt-6 text-center p-4 rounded-2xl bg-brand-50 dark:bg-slate-700/60">
                  <p className="text-sm text-brand-800 dark:text-slate-300">변환된 원화(KRW) 금액</p>
                  <p className="text-3xl font-bold mt-1 text-brand-600 dark:text-rose-400">
                    ₩ {manualResult}
                  </p>
                </div>
              )}
            </div>
          )}

          {mode === 'photo' && (
            <div id="photo-converter" className="animate-fade-in">
              <p className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-3 text-center">영수증 또는 가격표 사진</p>
              
              <div className="flex space-x-2">
                  <button 
                    onClick={triggerFileSelect}                     className="flex-1 btn-primary"
                  >
                    파일 선택
                  </button>
                  <input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
              </div>

              {imagePreview && (
                <div className="mt-4 relative group">
                  <img src={imagePreview} alt="선택한 이미지" className="rounded-2xl max-h-60 w-auto mx-auto shadow-soft" />
                  <button onClick={() => {setImagePreview(null); setImageFile(null); setPhotoResults([]);}} className="absolute top-2 right-2 bg-black bg-opacity-60 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold text-xl opacity-50 group-hover:opacity-100 transition-opacity">&times;</button>
                </div>
              )}
              
              {imageFile && (
                <button
                  onClick={handleDetectAndConvert}
                  disabled={isLoading}
                  className="w-full mt-4 btn-primary font-bold transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? '금액 감지 중...' : '사진에서 금액 변환'}
                </button>
              )}

              {error && <p className="mt-4 text-center p-3 rounded-xl text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/40">{error}</p>}
              
              {photoResults.length > 0 && (
                <div className="mt-4">
                  <h3 className="text-lg font-semibold text-center mb-3">변환 결과</h3>
                  <ul className="space-y-2">
                    {photoResults.map((result: { original: number; converted: number }, index: number) => (
                      <li key={index} className="flex justify-between items-center p-3 rounded-2xl bg-slate-100 dark:bg-slate-700/70">
                        <span className="text-gray-600 dark:text-slate-400">{result.original.toLocaleString('en-US')} THB</span>
                        <span className="text-brand-600 dark:text-rose-400 font-semibold">
                          ₩ {result.converted.toLocaleString('ko-KR', { maximumFractionDigits: 0 })}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </main>

        <footer className="text-center mt-8 text-sm text-slate-600 dark:text-slate-500">
            <div className="glass p-4 rounded-2xl flex items-center justify-center space-x-2">
                <span>적용 환율: 1 THB = </span>
                <input 
                    type="number"
                    value={exchangeRate}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setExchangeRate(parseFloat(e.target.value) || 0)}
                    className="w-24 font-semibold text-center rounded-md p-1 focus:outline-none focus:ring-2 bg-slate-100 text-brand-600 focus:ring-brand-500 dark:bg-slate-700 dark:text-rose-400 dark:focus:ring-brand-500"
                    step="0.1"
                />
                <span> KRW</span>
            </div>
            <p className="mt-4 text-xs sm:text-sm">이 서비스는 개발 단계의 가상 환율을 사용합니다.</p>
        </footer>
      </div>
    </div>
  );
};

export default App;