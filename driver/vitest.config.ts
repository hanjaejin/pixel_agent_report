import { defineConfig } from 'vitest/config';

// 드라이버 단위 테스트 설정.
// - 환경: node (브라우저 API 불필요)
// - 테스트 위치: __tests__ 폴더의 *.test.ts
export default defineConfig({
  test: {
    environment: 'node',
    include: ['__tests__/**/*.test.ts'],
  },
});
