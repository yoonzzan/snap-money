import React, { useState, useCallback, useRef, useEffect } from 'react';
import { DEFAULT_EXCHANGE_RATE } from './constants';

const ExchangeIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
  </svg>
);

const PhotoIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.776 48.776 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" />
    </svg>
);

const UploadIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
    </svg>
);


const Spinner: React.FC = () => (
    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
);

type Mode = 'manual' | 'image';

// Utility to convert File to base64 for Gemini API
const fileToGenerativePart = (file: File): Promise<{ base64Data: string, mimeType: string }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const base64Data = dataUrl.split(',')[1];
      if (base64Data) {
        resolve({ base64Data, mimeType: file.type });
      } else {
        reject(new Error('Failed to read file as base64.'));
      }
    };
    reader.onerror = (error) => reject(error);
  });
}

const ModeSwitcher: React.FC<{ activeMode: Mode, onModeChange: (mode: Mode) => void }> = ({ activeMode, onModeChange }) => (
    <div className="flex bg-slate-800/60 rounded-lg p-1 mb-6">
        <button
            onClick={() => onModeChange('manual')}
            className={`w-1/2 py-2 text-sm font-semibold rounded-md transition-colors duration-300 ${activeMode === 'manual' ? 'bg-cyan-500 text-white' : 'text-slate-300 hover:bg-slate-700/50'}`}
        >
            바트 금액 직접 입력
        </button>
        <button
            onClick={() => onModeChange('image')}
            className={`w-1/2 py-2 text-sm font-semibold rounded-md transition-colors duration-300 ${activeMode === 'image' ? 'bg-cyan-500 text-white' : 'text-slate-300 hover:bg-slate-700/50'}`}
        >
            사진으로 금액 변환
        </button>
    </div>
);

const App: React.FC = () => {
  const [mode, setMode] = useState<Mode>('image');

  // Exchange Rate State
  const [rateInput, setRateInput] = useState<string>(DEFAULT_EXCHANGE_RATE.toString());

  // Manual mode states
  const [thbAmount, setThbAmount] = useState<string>('');
  const [krwAmount, setKrwAmount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Image detection mode states
  const [isDetecting, setIsDetecting] = useState<boolean>(false);
  const [imageResults, setImageResults] = useState<{ thb: number; krw: number }[] | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  
  useEffect(() => {
    // Clean up the object URL to avoid memory leaks
    return () => {
      if (imagePreviewUrl) {
        URL.revokeObjectURL(imagePreviewUrl);
      }
    };
  }, [imagePreviewUrl]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setImageFile(file);
      setImagePreviewUrl(URL.createObjectURL(file));
      setImageResults(null);
      setImageError(null);
    }
  };
  
  const resetImageState = () => {
    setImageFile(null);
    setImagePreviewUrl(null);
    setImageResults(null);
    setImageError(null);
    if(fileInputRef.current) fileInputRef.current.value = "";
    if(cameraInputRef.current) cameraInputRef.current.value = "";
  };
  
  const getCurrentRate = () => {
      const rate = parseFloat(rateInput);
      return isNaN(rate) || rate <= 0 ? DEFAULT_EXCHANGE_RATE : rate;
  }

  const handleConvert = useCallback((e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setKrwAmount(null);

    const amount = thbAmount.trim();
    if (amount === '') {
      setError('바트 금액을 입력해주세요.');
      return;
    }

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount < 0) {
      setError('유효한 숫자를 입력해주세요. (예: "1200")');
      return;
    }
    
    const currentRate = getCurrentRate();
    setKrwAmount(numericAmount * currentRate);
  }, [thbAmount, rateInput]);

  const handleDetectAndConvert = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!imageFile) {
      setImageError('변환할 사진을 선택해주세요.');
      return;
    }
    
    setIsDetecting(true);
    setImageError(null);
    setImageResults(null);

    try {
      const { GoogleGenAI, Type } = await import('@google/genai');
      const { base64Data, mimeType } = await fileToGenerativePart(imageFile);
      
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

      const imagePart = { inlineData: { data: base64Data, mimeType } };
      const textPart = { text: `From the image, extract all numerical values representing Thai Baht amounts. Ignore currency symbols or prefixes like '฿' or 'THB'. Provide the result as a JSON object with a single key "amounts", which must be an array of numbers.` };

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: [imagePart, textPart] },
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              amounts: { type: Type.ARRAY, items: { type: Type.NUMBER } },
            },
            required: ['amounts'],
          },
        },
      });
      
      const responseText = response.text.trim();
      if (!responseText) {
        throw new Error('모델이 비어있는 응답을 반환했습니다.');
      }
      
      const parsed = JSON.parse(responseText);
      const amounts: number[] = parsed.amounts;

      if (!amounts || amounts.length === 0) {
        setImageError('사진에서 금액을 찾을 수 없습니다. 다른 사진으로 시도해보세요.');
        return;
      }
      
      const currentRate = getCurrentRate();
      setImageResults(amounts.map(thb => ({ thb, krw: thb * currentRate })));
    } catch (err) {
      console.error("Gemini API Error:", err);
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      setImageError(`금액 감지 중 오류가 발생했습니다: ${errorMessage}`);
    } finally {
      setIsDetecting(false);
    }
  }, [imageFile, rateInput]);

  return (
    <main className="bg-slate-900 min-h-screen w-full flex items-center justify-center p-4 text-white">
      <div className="w-full max-w-md mx-auto">
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-6 sm:p-8 border border-white/20">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold tracking-tight">스냅머니</h1>
            <p className="text-lg text-slate-300 mt-2">Snap Money</p>
          </div>

          <ModeSwitcher activeMode={mode} onModeChange={(newMode) => {
              setMode(newMode);
              // Reset states when switching modes
              setError(null);
              setKrwAmount(null);
              resetImageState();
          }} />

          {mode === 'manual' && (
            <>
              <form onSubmit={handleConvert} className="space-y-6">
                <div>
                  <label htmlFor="thb-amount" className="block text-sm font-medium text-slate-300 mb-2">
                    바트 금액 (THB)
                  </label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                      <span className="text-slate-400 text-lg">฿</span>
                    </div>
                    <input
                      type="text"
                      id="thb-amount"
                      inputMode="decimal"
                      value={thbAmount}
                      onChange={(e) => setThbAmount(e.target.value)}
                      placeholder="예: 5000"
                      className="w-full bg-slate-800/50 border border-slate-600 rounded-lg py-3 pl-10 pr-4 text-white placeholder-slate-500 focus:ring-2 focus:ring-cyan-400 focus:border-cyan-400 transition duration-200"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-bold py-3 px-4 rounded-lg shadow-lg transform hover:scale-105 transition-all duration-300 ease-in-out flex items-center justify-center space-x-2"
                >
                  <span>원화(KRW)로 변환</span>
                  <ExchangeIcon className="w-5 h-5" />
                </button>
              </form>
              {(krwAmount !== null || error) && (
                <div className="mt-8 pt-6 border-t border-slate-700 text-center">
                  {error ? (
                    <p className="text-red-400 font-semibold text-lg animate-pulse">{error}</p>
                  ) : krwAmount !== null ? (
                    <div>
                      <p className="text-slate-300 text-md">변환 결과</p>
                      <p className="text-3xl font-bold text-cyan-300 mt-1">
                        {krwAmount.toLocaleString('ko-KR', { maximumFractionDigits: 2 })} 원
                      </p>
                      <p className="text-slate-400 mt-2 text-sm">
                        {parseFloat(thbAmount).toLocaleString('ko-KR')} 바트가 변환되었습니다.
                      </p>
                    </div>
                  ) : null}
                </div>
              )}
            </>
          )}

          {mode === 'image' && (
             <>
              <form onSubmit={handleDetectAndConvert} className="space-y-6">
                 <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                        영수증 또는 가격표 사진
                    </label>
                    {imagePreviewUrl ? (
                         <div className="relative">
                             <img src={imagePreviewUrl} alt="Preview" className="w-full rounded-lg max-h-60 object-contain bg-slate-800/50" />
                             <button type="button" onClick={resetImageState} className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-1.5 hover:bg-black/80 transition-colors">
                                 <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                             </button>
                         </div>
                    ) : (
                        <div className='space-y-3'>
                            <input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
                            <input type="file" accept="image/*" capture="environment" ref={cameraInputRef} onChange={handleFileChange} className="hidden" />
                            <button type="button" onClick={() => fileInputRef.current?.click()} className="w-full flex items-center justify-center space-x-2 bg-slate-800/50 border border-slate-600 rounded-lg py-3 px-4 text-slate-300 hover:bg-slate-700/50 hover:border-slate-500 transition duration-200">
                                <UploadIcon className="w-5 h-5"/>
                                <span>파일 선택</span>
                            </button>
                             <button type="button" onClick={() => cameraInputRef.current?.click()} className="w-full flex items-center justify-center space-x-2 bg-slate-800/50 border border-slate-600 rounded-lg py-3 px-4 text-slate-300 hover:bg-slate-700/50 hover:border-slate-500 transition duration-200">
                                <PhotoIcon className="w-5 h-5"/>
                                <span>사진 찍기</span>
                            </button>
                        </div>
                    )}
                </div>
                <button
                  type="submit"
                  disabled={isDetecting || !imageFile}
                  className="w-full bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white font-bold py-3 px-4 rounded-lg shadow-lg transform hover:scale-105 transition-all duration-300 ease-in-out flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                >
                  {isDetecting ? (
                      <>
                        <Spinner />
                        <span>금액 감지 중...</span>
                      </>
                  ) : (
                     <>
                        <span>사진에서 금액 변환</span>
                     </>
                  )}
                </button>
              </form>
               {(imageResults || imageError) && (
                <div className="mt-8 pt-6 border-t border-slate-700">
                    {imageError && (
                        <p className="text-red-400 font-semibold text-lg text-center">{imageError}</p>
                    )}
                    {imageResults && (
                        <div>
                            <p className="text-slate-300 text-md mb-4 text-center">사진 변환 결과</p>
                            <ul className="space-y-3 text-left">
                                {imageResults.map((result, index) => (
                                    <li key={index} className="bg-slate-800/50 p-3 rounded-lg flex justify-between items-center animate-fade-in" style={{animationDelay: `${index * 100}ms`}}>
                                        <span className="text-slate-300">฿ {result.thb.toLocaleString('ko-KR')}</span>
                                        <ExchangeIcon className="w-4 h-4 text-slate-500 mx-2 flex-shrink-0" />
                                        <span className="font-bold text-cyan-300 text-lg text-right">{result.krw.toLocaleString('ko-KR', { maximumFractionDigits: 0 })} 원</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                 </div>
               )}
            </>
          )}

        </div>
        <div className="text-center mt-6 text-slate-500 text-sm space-y-2">
            <div className="flex items-center justify-center space-x-2">
                <label htmlFor="exchange-rate-input" className="whitespace-nowrap">적용 환율: 1 THB =</label>
                <input
                    id="exchange-rate-input"
                    type="text"
                    inputMode="decimal"
                    value={rateInput}
                    onChange={(e) => setRateInput(e.target.value)}
                    className="bg-slate-800/60 border border-slate-700 rounded-md w-20 text-center py-1 text-white focus:ring-1 focus:ring-cyan-400 focus:border-cyan-400 transition"
                    aria-label="Custom exchange rate"
                />
                <span className="whitespace-nowrap">KRW</span>
            </div>
            <p>이 서비스는 개발 단계의 가상 환율을 사용합니다.</p>
        </div>
      </div>
    </main>
  );
};

export default App;