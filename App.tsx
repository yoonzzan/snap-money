import React, { useState, useRef, ChangeEvent } from 'react';
import { GoogleGenAI, Type } from '@google/genai';
import { DEFAULT_EXCHANGE_RATE } from './constants';

type Mode = 'manual' | 'photo';

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
    <div className="bg-slate-900 text-white min-h-screen flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold text-cyan-400">Snap Money</h1>
          <p className="text-slate-400 mt-2">태국 바트(THB) 🇹🇭 → 대한민국 원(KRW) 🇰🇷</p>
        </header>

        <main className="bg-slate-800 rounded-lg p-6 shadow-lg">
          <div className="flex border-b border-slate-700 mb-6">
            <button
              onClick={() => setMode('manual')}
              className={`flex-1 py-3 text-center font-semibold rounded-t-md transition-colors ${mode === 'manual' ? 'bg-cyan-500 text-slate-900' : 'bg-transparent text-slate-400 hover:bg-slate-700'}`}
            >
              바트 금액 직접 입력
            </button>
            <button
              onClick={() => setMode('photo')}
              className={`flex-1 py-3 text-center font-semibold rounded-t-md transition-colors ${mode === 'photo' ? 'bg-cyan-500 text-slate-900' : 'bg-transparent text-slate-400 hover:bg-slate-700'}`}
            >
              사진으로 금액 변환
            </button>
          </div>

          {mode === 'manual' && (
            <div id="manual-converter">
              <label htmlFor="thb-input" className="block text-sm font-medium text-slate-300 mb-2">
                바트(THB) 금액
              </label>
              <input
                type="number"
                id="thb-input"
                value={manualInput}
                onChange={handleManualInputChange}
                placeholder="예: 1200"
                className="w-full bg-slate-700 border border-slate-600 rounded-md p-3 text-white placeholder-slate-500 focus:ring-2 focus:ring-cyan-500 focus:outline-none"
              />
              {manualResult && (
                <div className="mt-4 text-center bg-slate-700 p-4 rounded-lg">
                  <p className="text-slate-400">변환된 원화(KRW) 금액</p>
                  <p className="text-3xl font-bold text-cyan-400 mt-1">
                    ₩ {manualResult}
                  </p>
                </div>
              )}
            </div>
          )}

          {mode === 'photo' && (
            <div id="photo-converter">
              <p className="text-sm font-medium text-slate-300 mb-3 text-center">영수증 또는 가격표 사진</p>
              
              <div className="flex space-x-2">
                  <button onClick={triggerFileSelect} className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-300 font-semibold py-3 px-4 rounded-md transition-colors">
                    파일 선택
                  </button>
                  <input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
              </div>

              {imagePreview && (
                <div className="mt-4 relative">
                  <img src={imagePreview} alt="선택한 이미지" className="rounded-lg max-h-60 w-auto mx-auto" />
                  <button onClick={() => {setImagePreview(null); setImageFile(null); setPhotoResults([]);}} className="absolute top-2 right-2 bg-black bg-opacity-50 text-white rounded-full w-7 h-7 flex items-center justify-center font-bold text-lg">&times;</button>
                </div>
              )}
              
              {imageFile && (
                <button
                  onClick={handleDetectAndConvert}
                  disabled={isLoading}
                  className="w-full mt-4 bg-gradient-to-r from-purple-500 to-cyan-500 hover:from-purple-600 hover:to-cyan-600 text-white font-bold py-3 px-4 rounded-lg transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? '금액 감지 중...' : '사진에서 금액 변환'}
                </button>
              )}

              {error && <p className="mt-4 text-center text-red-400 bg-red-900 bg-opacity-30 p-3 rounded-md">{error}</p>}
              
              {photoResults.length > 0 && (
                <div className="mt-4">
                  <h3 className="text-lg font-semibold text-center mb-3">변환 결과</h3>
                  <ul className="space-y-2">
                    {photoResults.map((result: { original: number; converted: number }, index: number) => (
                      <li key={index} className="flex justify-between items-center bg-slate-700 p-3 rounded-md">
                        <span className="text-slate-400">{result.original.toLocaleString('en-US')} THB</span>
                        <span className="text-cyan-400 font-semibold">₩ {result.converted.toLocaleString('ko-KR', { maximumFractionDigits: 0 })}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </main>

        <footer className="text-center mt-8 text-xs text-slate-500">
            <div className="bg-slate-800 p-4 rounded-lg flex items-center justify-center space-x-2">
                <span>적용 환율: 1 THB = </span>
                <input 
                    type="number"
                    value={exchangeRate}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setExchangeRate(parseFloat(e.target.value) || 0)}
                    className="bg-slate-700 w-20 text-cyan-400 font-semibold text-center rounded-md p-1 focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                    step="0.1"
                />
                <span> KRW</span>
            </div>
            <p className="mt-3">이 서비스는 개발 단계의 가상 환율을 사용합니다.</p>
        </footer>
      </div>
    </div>
  );
};

export default App;