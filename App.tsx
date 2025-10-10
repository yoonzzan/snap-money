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
  const [theme, setTheme] = useState<Theme>('light');
  
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
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    setTheme(prefersDark ? 'dark' : 'light');

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      setTheme(e.matches ? 'dark' : 'light');
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

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
        // Check for specific API key error
        if (err.message.includes('API Key')) {
            errorMessage = 'API 키가 설정되지 않았거나 유효하지 않습니다. Vercel 환경 변수를 확인해주세요.';
        } else {
            errorMessage += `: ${err.message}`;
        }
      }
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`${theme === 'light' ? 'bg-slate-50 text-gray-800' : 'bg-slate-900 text-white'} min-h-screen flex flex-col items-center justify-center p-4 font-sans transition-colors duration-300`}>
      <div className="w-full max-w-md mx-auto">
        <header className="relative text-center mb-8">
          <h1 className={`text-5xl font-bold ${theme === 'light' ? 'text-indigo-600' : 'text-cyan-400'}`}>Snap Money</h1>
          <p className={`${theme === 'light' ? 'text-slate-500' : 'text-slate-400'} mt-2`}>태국 바트(THB) 🇹🇭 → 대한민국 원(KRW) 🇰🇷</p>
          <button 
            onClick={toggleTheme} 
            className={`absolute top-0 right-0 p-2 rounded-full transition-colors duration-300 ${theme === 'light' ? 'bg-slate-200 hover:bg-slate-300 text-slate-800' : 'bg-slate-800 hover:bg-slate-700 text-white'}`}
            aria-label="Toggle theme"
          >
            {theme === 'light' ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m8.66-15.66l-.707.707M4.04 19.96l-.707.707M21 12h-1M4 12H3m15.66 8.66l-.707-.707M4.04 4.04l-.707-.707" /></svg>
            )}
          </button>
        </header>

        <main className={`${theme === 'light' ? 'bg-white' : 'bg-slate-800'} rounded-xl p-6 shadow-lg`}>
          <div className={`flex border-b ${theme === 'light' ? 'border-gray-200' : 'border-slate-700'} mb-6`}>
            <button
              onClick={() => setMode('manual')}
              className={`flex-1 py-3 text-center font-semibold rounded-t-lg transition-colors duration-300 ${
                mode === 'manual' 
                  ? (theme === 'light' ? 'bg-indigo-500 text-white' : 'bg-cyan-500 text-slate-900') 
                  : (theme === 'light' ? 'bg-transparent text-gray-500 hover:bg-indigo-50 hover:text-indigo-600' : 'bg-transparent text-slate-400 hover:bg-slate-700')
              }`}
            >
              바트 금액 직접 입력
            </button>
            <button
              onClick={() => setMode('photo')}
              className={`flex-1 py-3 text-center font-semibold rounded-t-lg transition-colors duration-300 ${
                mode === 'photo' 
                  ? (theme === 'light' ? 'bg-indigo-500 text-white' : 'bg-cyan-500 text-slate-900') 
                  : (theme === 'light' ? 'bg-transparent text-gray-500 hover:bg-indigo-50 hover:text-indigo-600' : 'bg-transparent text-slate-400 hover:bg-slate-700')
              }`}
            >
              사진으로 금액 변환
            </button>
          </div>

          {mode === 'manual' && (
            <div id="manual-converter" className="animate-fade-in">
              <label htmlFor="thb-input" className={`block text-sm font-medium ${theme === 'light' ? 'text-gray-700' : 'text-slate-300'} mb-2`}>
                바트(THB) 금액
              </label>
              <input
                type="number"
                id="thb-input"
                value={manualInput}
                onChange={handleManualInputChange}
                placeholder="예: 1200"
                className={`w-full p-3 rounded-lg transition-shadow ${
                  theme === 'light' 
                    ? 'bg-slate-100 border border-slate-300 text-gray-800 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 focus:outline-none' 
                    : 'bg-slate-700 border border-slate-600 text-white placeholder-slate-500 focus:ring-2 focus:ring-cyan-500 focus:outline-none'
                }`}
              />
              {manualResult && (
                <div className={`mt-6 text-center p-4 rounded-xl ${theme === 'light' ? 'bg-indigo-50' : 'bg-slate-700'}`}>
                  <p className={`${theme === 'light' ? 'text-indigo-800' : 'text-slate-400'}`}>변환된 원화(KRW) 금액</p>
                  <p className={`text-3xl font-bold mt-1 ${theme === 'light' ? 'text-indigo-600' : 'text-cyan-400'}`}>
                    ₩ {manualResult}
                  </p>
                </div>
              )}
            </div>
          )}

          {mode === 'photo' && (
            <div id="photo-converter" className="animate-fade-in">
              <p className={`text-sm font-medium ${theme === 'light' ? 'text-gray-700' : 'text-slate-300'} mb-3 text-center`}>영수증 또는 가격표 사진</p>
              
              <div className="flex space-x-2">
                  <button 
                    onClick={triggerFileSelect} 
                    className={`flex-1 font-semibold py-3 px-4 rounded-lg transition-colors duration-300 ${
                      theme === 'light' 
                        ? 'bg-slate-200 hover:bg-slate-300 text-slate-800' 
                        : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                    }`}
                  >
                    파일 선택
                  </button>
                  <input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
              </div>

              {imagePreview && (
                <div className="mt-4 relative group">
                  <img src={imagePreview} alt="선택한 이미지" className={`rounded-xl max-h-60 w-auto mx-auto ${theme === 'light' ? 'shadow-md' : ''}`} />
                  <button onClick={() => {setImagePreview(null); setImageFile(null); setPhotoResults([]);}} className="absolute top-2 right-2 bg-black bg-opacity-60 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold text-xl opacity-50 group-hover:opacity-100 transition-opacity">&times;</button>
                </div>
              )}
              
              {imageFile && (
                <button
                  onClick={handleDetectAndConvert}
                  disabled={isLoading}
                  className={`w-full mt-4 text-white font-bold py-3 px-4 rounded-lg transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed ${
                    theme === 'light' 
                      ? 'bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600' 
                      : 'bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-700 hover:to-cyan-700'
                  }`}
                >
                  {isLoading ? '금액 감지 중...' : '사진에서 금액 변환'}
                </button>
              )}

              {error && <p className={`mt-4 text-center p-3 rounded-lg ${theme === 'light' ? 'text-red-600 bg-red-100' : 'text-red-400 bg-red-900 bg-opacity-30'}`}>{error}</p>}
              
              {photoResults.length > 0 && (
                <div className="mt-4">
                  <h3 className="text-lg font-semibold text-center mb-3">변환 결과</h3>
                  <ul className="space-y-2">
                    {photoResults.map((result: { original: number; converted: number }, index: number) => (
                      <li key={index} className={`flex justify-between items-center p-3 rounded-lg ${theme === 'light' ? 'bg-slate-100' : 'bg-slate-700'}`}>
                        <span className={`${theme === 'light' ? 'text-gray-600' : 'text-slate-400'}`}>{result.original.toLocaleString('en-US')} THB</span>
                        <span className={`${theme === 'light' ? 'text-indigo-600' : 'text-cyan-400'} font-semibold`}>
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

        <footer className={`text-center mt-8 text-sm ${theme === 'light' ? 'text-slate-600' : 'text-slate-500'}`}>
            <div className={`${theme === 'light' ? 'bg-white shadow-md' : 'bg-slate-800'} p-4 rounded-xl flex items-center justify-center space-x-2`}>
                <span>적용 환율: 1 THB = </span>
                <input 
                    type="number"
                    value={exchangeRate}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setExchangeRate(parseFloat(e.target.value) || 0)}
                    className={`w-24 font-semibold text-center rounded-md p-1 focus:outline-none focus:ring-2 ${
                      theme === 'light' 
                        ? 'bg-slate-100 text-indigo-600 focus:ring-indigo-500' 
                        : 'bg-slate-700 text-cyan-400 focus:ring-cyan-500'
                    }`}
                    step="0.1"
                />
                <span> KRW</span>
            </div>
            <p className="mt-4">이 서비스는 개발 단계의ㅅㅅㅅㅅㅅㅅ 가상 환율을 사용합니다.</p>
        </footer>
      </div>
    </div>
  );
};

export default App;