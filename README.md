<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Snap Money - THB → KRW 변환기

사진/수동 입력으로 태국 바트를 원화로 변환하는 간단한 앱입니다.

AI Studio 앱 링크(옵션): https://ai.studio/apps/drive/16aqJL2b0Cclg9CE_EeIog3_bC2XnJuy0

## 로컬 실행

**Prerequisites:**  Node.js


1. 의존성 설치: `npm install`
2. 환경변수 설정: 루트에 `.env.local` 파일 생성 후 아래를 작성

   ```bash
   VITE_GEMINI_API_KEY=your_api_key
   ```

3. 앱 실행: `npm run dev`

## Vercel 배포

1. Vercel에 새 프로젝트로 이 리포지토리를 연결합니다.
2. 환경변수 추가: 프로젝트 Settings → Environment Variables

   - `VITE_GEMINI_API_KEY` = Gemini API Key

3. 빌드/런타임 설정

   - Framework Preset: Vite
   - Build Command: `npm run build`
   - Output Directory: `dist`

4. 배포하면 완료됩니다. 배포 후 에러가 난다면 프로젝트 로그에서 `VITE_GEMINI_API_KEY`가 주입되었는지 확인하세요.
