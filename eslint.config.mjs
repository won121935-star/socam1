import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // 초기 데이터 페칭 + 외부 API 호출은 effect 안에서 setState가 정상적인 패턴이라
    // React 19의 새 경고는 과도함. 앱 규모가 커지면 react-query 등으로 옮길 예정.
    rules: {
      "react-hooks/set-state-in-effect": "off",
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "prisma/generated/**",
  ]),
]);

export default eslintConfig;
