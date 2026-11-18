# Unit testing

Unit test của backend dùng Vitest và hiện được đặt gần source tại `src/**/*.spec.ts`; `vitest.config.ts` đã chỉ định đúng pattern này. Vì vậy không di chuyển hoặc nhân bản test sang đây để tránh chạy trùng.

Chạy bằng `npm test`, hoặc coverage bằng `npm run test:cov`.
