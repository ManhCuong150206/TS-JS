# unit

Dùng cho kiểm thử từng service hoặc helper. Đặt tên file `*.spec.ts` và tổ chức theo cấu trúc tương ứng trong `src/`, ví dụ `test/unit/modules/datasets/`.

Import mã nguồn bằng đường dẫn tương đối có đuôi `.js`. Đoạn dưới đây nhập `DatasetsService` từ một spec trong `test/unit/modules/datasets/`.

```ts
import {
  DatasetsService,
} from '../../../../src/modules/datasets/datasets.service.js';
```

[`vitest.config.ts`](../../vitest.config.ts) hiện dùng `include: ['src/**/*.spec.ts']`. Để `npm test` tìm spec trong thư mục này, cần cập nhật thành `include: ['src/**/*.spec.ts', 'test/unit/**/*.spec.ts'],`.
