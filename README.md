# Studio/01

작은 인터랙티브 실험을 모아두는 TypeScript 웹 프로젝트입니다.

## 시작하기

```powershell
npm install
npm run dev
```

현재 웹 프로젝트는 Home 화면만 제공합니다. 새로운 실험은 독립된 기능으로 추가하며, 화면 진입점과 앱 전체 조립을 불필요하게 결합하지 않습니다.

## 프로젝트 구조

```text
src/
├─ main.ts
├─ app/
│  └─ pages/
│     └─ home/
│        └─ page.ts
└─ styles/
   └─ global.css
```

## 검증

```powershell
npm run format
npm run check
npm run build
```
