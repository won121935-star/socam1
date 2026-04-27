# Brand Archive

팀 내부용 브랜드/광고 영상 검색 + 아카이브 도구.

- **통합 검색** — YouTube Data API v3 실시간 검색 + 내부 아카이브를 한 화면에서 같이 조회
- **임베드 재생** — 카드 클릭 → 모달에서 바로 재생
- **아카이브** — 클릭 한 번으로 팀 라이브러리에 저장, 중복 URL 자동 병합
- **태그 / 별점 / 메모** — 팀원들이 "왜 좋은지" 기록, 태그로 필터
- **tvcf.co.kr 지원** — URL 붙여넣기로 메타데이터 자동 추출 (OpenGraph). 임베드 불가 시 원본 링크로 fallback

스택: Next.js 16 App Router · Prisma 7 + SQLite · Tailwind v4 · Lucide 아이콘

---

## 빠른 시작

```bash
# 1. 의존성 설치 (이미 되어있으면 생략)
npm install

# 2. 환경변수 설정
cp .env.example .env
# .env 파일을 열고 YOUTUBE_API_KEY 를 채워주세요 (아래 "YouTube API 키 발급" 참고)

# 3. DB 초기화 (이미 prisma/dev.db가 있으면 생략)
npx prisma migrate dev
npx prisma generate

# 4. 개발 서버
npm run dev
```

브라우저에서 http://localhost:3000 접속.

---

## YouTube API 키 발급 (5분)

1. https://console.cloud.google.com/ 접속 → 새 프로젝트 생성 (이름은 아무거나, 예: `brand-archive`)
2. 좌측 메뉴 → **API 및 서비스 → 라이브러리** → "YouTube Data API v3" 검색 → **사용 설정**
3. 좌측 메뉴 → **API 및 서비스 → 사용자 인증 정보** → 상단 **+ 사용자 인증 정보 만들기** → **API 키**
4. 생성된 키를 복사해 프로젝트의 `.env`에 붙여넣기:

```
YOUTUBE_API_KEY=AIza...
```

5. 개발 서버를 재시작 (`Ctrl+C` 후 `npm run dev`)

**할당량:** 기본 일 10,000 유닛. 검색 1회 ≈ 100 유닛이므로 하루 ~100회 검색 가능. 팀 내부용으로는 충분합니다. 부족해지면 Cloud Console에서 무료 증설 신청 가능.

**보안 팁:** API 키를 제한(Referer / IP)으로 잠그는 걸 추천. Cloud Console → 사용자 인증 정보 → 해당 키 클릭 → "애플리케이션 제한사항" 설정.

---

## 사용법

### 검색 탭
1. 상단 검색창에 키워드 입력 → Enter
2. 내부 아카이브 결과가 먼저 보이고, 그 아래 YouTube 실시간 결과
3. 카드 클릭 → 모달에서 재생 + 태그/별점/메모 편집
4. 카드의 **아카이브** 버튼을 누르면 한 번에 팀 라이브러리에 저장

### URL로 추가 (상단 우측 버튼)
- YouTube URL: 자동으로 제목/채널/길이/썸네일 가져옴
- tvcf.co.kr URL: 페이지의 OpenGraph 메타 태그에서 제목/썸네일 추출
- 기타 사이트(Vimeo, 개인 호스팅 등): OpenGraph 있으면 자동 추출

### 아카이브 탭
- 전체 목록 + 태그 필터 칩
- 카드 클릭 → 상세에서 편집/삭제

---

## tvcf.co.kr에 대한 제약 사항

tvcf.co.kr은 유료 로그인 기반 서비스이고 공식 API가 없습니다. 이 프로젝트는 **팀원이 tvcf에서 본 영상의 URL을 붙여넣는 수동 방식**만 지원합니다.

- ✅ OpenGraph 메타 태그에서 제목/썸네일 추출 (공개된 정보)
- ✅ 원본 페이지로 이동하는 링크 제공
- ❌ 자동 크롤링/키워드 검색 — ToS 위반 소지가 있어 의도적으로 구현하지 않음
- ❌ 사이트 내 임베드 재생 — tvcf가 iframe 임베드를 제공하지 않음

TVCF 영상은 카드 클릭 시 "원본 페이지에서 재생" 링크로 이동합니다.

---

## 배포 (팀 내부 접근)

### 옵션 A — Vercel (가장 쉬움, 무료)
```bash
npx vercel
```
환경변수 `DATABASE_URL`, `YOUTUBE_API_KEY` 설정. SQLite 대신 Vercel Postgres 또는 Turso로 교체 필요 (Vercel serverless는 파일 DB 부적합).

### 옵션 B — 자체 호스팅 (사내 서버)
```bash
npm run build
npm run start
```
SQLite 그대로 사용 가능. reverse proxy(Nginx) + 사내망에서 접근.

### 옵션 C — 로컬만 사용
이미 `npm run dev`로 로컬 사용 중. 네트워크 내 공유는 `next dev --hostname 0.0.0.0` 로 변경.

---

## 프로젝트 구조

```
src/
├── app/
│   ├── api/
│   │   ├── search/         # GET: YouTube + 아카이브 통합 검색
│   │   ├── metadata/       # POST: URL에서 메타데이터 추출 (미리보기용)
│   │   ├── videos/         # GET: 아카이브 리스트 / POST: 저장
│   │   ├── videos/[id]/    # GET / PATCH (태그·별점) / DELETE
│   │   ├── notes/          # POST / DELETE
│   │   └── tags/           # GET: 태그 집계
│   ├── layout.tsx
│   └── page.tsx            # 메인 UI (검색 + 아카이브 탭)
├── components/
│   ├── VideoCard.tsx
│   ├── VideoModal.tsx      # 임베드 재생 + 편집
│   ├── AddUrlDialog.tsx
│   └── SourceBadge.tsx
└── lib/
    ├── db.ts               # Prisma 싱글톤
    ├── youtube.ts          # YouTube Data API v3 래퍼
    ├── url-parser.ts       # URL → source/embedUrl 판별
    ├── metadata.ts         # OpenGraph + oEmbed 추출
    └── cn.ts
prisma/
├── schema.prisma           # Video / Tag / Collection / Note
└── migrations/
```

---

## 앞으로 추가할 만한 기능

- 컬렉션(폴더) — UI 미구현, 모델은 있음
- 다중 선택 후 일괄 태그/컬렉션 적용
- 업로드 날짜 · 길이 필터
- 로그인 — 현재는 익명 (작성자 이름은 localStorage에 저장)
- Vimeo/TikTok 임베드 지원
- CSV / JSON 내보내기 백업
