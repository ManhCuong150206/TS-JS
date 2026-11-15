# Sắp xếp lại src ngày 2026-11-15

## Trước khi sửa

- Nhánh `restructure-src` bắt đầu từ `5138d860d774b89a5220dbdca5068a12c3e5ccb8`.
- Dùng thư mục `docs/` đã có ở gốc repo. Tạo báo cáo trong `docs/changes/`.
- `src/` có **61 file** (51 TypeScript và 10 README). Sáu module và các file cần chuyển đều có đúng tên trong bảng yêu cầu.
- Khác cấu trúc dự kiến, `test/` đã tồn tại với ba file bên dưới. Hai thư mục `test/unit/` và `test/e2e/` chưa có.
- Worktree đã có thay đổi ở `src.rar` và ba file HTML chưa được Git theo dõi trong `docs/`.

### Cây thư mục

```text
src/
  app.controller.spec.ts
  app.controller.ts
  app.module.ts
  app.service.ts
  common/
    auth.guard.ts
    configure-app.ts
    csv-validator.spec.ts
    csv-validator.ts
    database.config.ts
    ownership.ts
    pagination.ts
    README.md
    session.config.spec.ts
    session.config.ts
  datasets/
    datasets.controller.ts
    datasets.module.ts
    datasets.service.ts
    dto/
      create-dataset.dto.ts
    README.md
    schemas/
      dataset.schema.ts
    upload.config.spec.ts
    upload.config.ts
  experiments/
    dto/
      create-experiment.dto.ts
      README.md
    experiments.controller.spec.ts
    experiments.controller.ts
    experiments.module.ts
    experiments.service.spec.ts
    experiments.service.ts
    README.md
    saved-snapshot.ts
    schemas/
      experiment.schema.ts
      README.md
    synthetic-config.validation.ts
  login/
    audit.schema.ts
    audit.service.ts
    auth.dto.ts
    login.controller.ts
    login.module.ts
    login.service.ts
    README.md
    user.schema.ts
  main.ts
  README.md
  sync/
    dto/
      sync.dto.ts
    README.md
    schemas/
      sync-operation.schema.ts
    sync.controller.ts
    sync.module.ts
    sync.service.ts
  training-runs/
    dto/
      create-training-run.dto.ts
    README.md
    schemas/
      training-run.schema.ts
    training-runs.controller.ts
    training-runs.module.ts
    training-runs.service.ts
  users/
    README.md
    users.controller.ts
    users.dto.ts
    users.module.ts
    users.service.ts
test/
  app.e2e-spec.ts
  cleanup-browser-backend.mjs
  run-browser-backend.mjs
```

### Kết quả chạy

| Lệnh | Kết quả |
|---|---|
| `npx.cmd tsc --noEmit` | Exit 0, không có diagnostic |
| `npm.cmd test` | Exit 0, Vitest 4.1.11, 6/6 file và 38/38 test đạt |
| `npm.cmd run build` | Exit 0, `nest build` |

### Danh sách route

Script Node tạm đọc AST TypeScript của các decorator `@Controller`, `@Get`, `@Post`, `@Patch`, `@Put`, `@Delete` và lấy tiền tố global từ `setGlobalPrefix`. Kết quả đã sắp xếp có 27 route.

```text
DELETE /api/v1/datasets/:id
DELETE /api/v1/experiments/:id
DELETE /api/v1/users/me
GET /api/v1
GET /api/v1/auth/me
GET /api/v1/datasets
GET /api/v1/datasets/:id
GET /api/v1/datasets/:id/download
GET /api/v1/experiments
GET /api/v1/experiments/:id
GET /api/v1/health
GET /api/v1/sync/changes
GET /api/v1/training-runs
GET /api/v1/training-runs/:id
GET /api/v1/users/me
PATCH /api/v1/experiments/:id
POST /api/v1/auth/login
POST /api/v1/auth/logout
POST /api/v1/auth/register
POST /api/v1/datasets
POST /api/v1/datasets/upload
POST /api/v1/experiments
POST /api/v1/experiments/bulk
POST /api/v1/sync/batch
POST /api/v1/training-runs
POST /api/v1/users/me
POST /api/v1/users/me/password
```

### File ngoài src cần đối chiếu

| Vị trí | Nội dung cần kiểm tra |
|---|---|
| `test/app.e2e-spec.ts`, `test/run-browser-backend.mjs`, `test/cleanup-browser-backend.mjs` | Import tới mã nguồn và bản build, vị trí file e2e và các script hỗ trợ |
| `package.json`, `vitest.config.ts`, `vitest.config.e2e.ts`, `tsconfig.json`, `tsconfig.build.json`, `nest-cli.json`, `.oxlintrc.json` | Lệnh test/lint, mẫu tìm test, phạm vi kiểm tra kiểu và build |
| `Dockerfile.api`, `Dockerfile.api.dockerignore`, `docker-compose.yml`, `deploy/` | Đường dẫn tới source, bản build và điểm khởi động ứng dụng |
| `README.md`, `BAO-CAO-CAP-NHAT-2026-11-03.md`, `docs/` | Link README và tham chiếu tới file chuyển vị trí |

## Đã sửa gì

Dùng `git mv` cho 54 file. Các spec trong `src/` đi cùng code tương ứng. Sáu file tại gốc `src/` và `src/common/README.md` giữ vị trí. README hiện có được cập nhật ở các link và lệnh nhắc đến đường dẫn đã chuyển.

### File đã chuyển

| Cũ | Mới | Lý do |
|---|---|---|
| `src/common/auth.guard.ts` | `src/common/guards/auth.guard.ts` | Đặt guard dùng chung trong thư mục guard. |
| `src/common/configure-app.ts` | `src/config/configure-app.ts` | Tập trung cấu hình backend. |
| `src/common/csv-validator.spec.ts` | `src/shared/helpers/csv-validator.spec.ts` | Đặt spec cạnh helper tương ứng. |
| `src/common/csv-validator.ts` | `src/shared/helpers/csv-validator.ts` | Đặt helper dùng chung tại cùng một vị trí. |
| `src/common/database.config.ts` | `src/config/database.config.ts` | Tập trung cấu hình backend. |
| `src/common/ownership.ts` | `src/shared/helpers/ownership.ts` | Đặt helper dùng chung tại cùng một vị trí. |
| `src/common/pagination.ts` | `src/shared/helpers/pagination.ts` | Đặt helper dùng chung tại cùng một vị trí. |
| `src/common/session.config.spec.ts` | `src/config/session.config.spec.ts` | Đặt spec cạnh cấu hình tương ứng. |
| `src/common/session.config.ts` | `src/config/session.config.ts` | Tập trung cấu hình backend. |
| `src/datasets/README.md` | `src/modules/datasets/README.md` | Đưa file đi cùng module. |
| `src/datasets/datasets.controller.ts` | `src/modules/datasets/datasets.controller.ts` | Đưa file đi cùng module. |
| `src/datasets/datasets.module.ts` | `src/modules/datasets/datasets.module.ts` | Đưa file đi cùng module. |
| `src/datasets/datasets.service.ts` | `src/modules/datasets/datasets.service.ts` | Đưa file đi cùng module. |
| `src/datasets/dto/create-dataset.dto.ts` | `src/modules/datasets/dto/create-dataset.dto.ts` | Đưa file đi cùng module. |
| `src/datasets/schemas/dataset.schema.ts` | `src/modules/datasets/schemas/dataset.schema.ts` | Đưa file đi cùng module. |
| `src/datasets/upload.config.spec.ts` | `src/config/upload.config.spec.ts` | Đặt spec cạnh cấu hình tương ứng. |
| `src/datasets/upload.config.ts` | `src/config/upload.config.ts` | Tập trung cấu hình backend. |
| `src/experiments/README.md` | `src/modules/experiments/README.md` | Đưa file đi cùng module. |
| `src/experiments/dto/README.md` | `src/modules/experiments/dto/README.md` | Đưa file đi cùng module. |
| `src/experiments/dto/create-experiment.dto.ts` | `src/modules/experiments/dto/create-experiment.dto.ts` | Đưa file đi cùng module. |
| `src/experiments/experiments.controller.spec.ts` | `src/modules/experiments/experiments.controller.spec.ts` | Đưa file đi cùng module. |
| `src/experiments/experiments.controller.ts` | `src/modules/experiments/experiments.controller.ts` | Đưa file đi cùng module. |
| `src/experiments/experiments.module.ts` | `src/modules/experiments/experiments.module.ts` | Đưa file đi cùng module. |
| `src/experiments/experiments.service.spec.ts` | `src/modules/experiments/experiments.service.spec.ts` | Đưa file đi cùng module. |
| `src/experiments/experiments.service.ts` | `src/modules/experiments/experiments.service.ts` | Đưa file đi cùng module. |
| `src/experiments/saved-snapshot.ts` | `src/modules/experiments/saved-snapshot.ts` | Đưa file đi cùng module. |
| `src/experiments/schemas/README.md` | `src/modules/experiments/schemas/README.md` | Đưa file đi cùng module. |
| `src/experiments/schemas/experiment.schema.ts` | `src/modules/experiments/schemas/experiment.schema.ts` | Đưa file đi cùng module. |
| `src/experiments/synthetic-config.validation.ts` | `src/shared/helpers/synthetic-config.validation.ts` | Đặt helper dùng chung tại cùng một vị trí. |
| `src/login/README.md` | `src/modules/login/README.md` | Đưa file đi cùng module. |
| `src/login/audit.schema.ts` | `src/modules/login/schemas/audit.schema.ts` | Gom schema của module. |
| `src/login/audit.service.ts` | `src/modules/login/audit.service.ts` | Đưa file đi cùng module. |
| `src/login/auth.dto.ts` | `src/modules/login/dto/auth.dto.ts` | Gom DTO của module. |
| `src/login/login.controller.ts` | `src/modules/login/login.controller.ts` | Đưa file đi cùng module. |
| `src/login/login.module.ts` | `src/modules/login/login.module.ts` | Đưa file đi cùng module. |
| `src/login/login.service.ts` | `src/modules/login/login.service.ts` | Đưa file đi cùng module. |
| `src/login/user.schema.ts` | `src/modules/login/schemas/user.schema.ts` | Gom schema của module. |
| `src/sync/README.md` | `src/modules/sync/README.md` | Đưa file đi cùng module. |
| `src/sync/dto/sync.dto.ts` | `src/modules/sync/dto/sync.dto.ts` | Đưa file đi cùng module. |
| `src/sync/schemas/sync-operation.schema.ts` | `src/modules/sync/schemas/sync-operation.schema.ts` | Đưa file đi cùng module. |
| `src/sync/sync.controller.ts` | `src/modules/sync/sync.controller.ts` | Đưa file đi cùng module. |
| `src/sync/sync.module.ts` | `src/modules/sync/sync.module.ts` | Đưa file đi cùng module. |
| `src/sync/sync.service.ts` | `src/modules/sync/sync.service.ts` | Đưa file đi cùng module. |
| `src/training-runs/README.md` | `src/modules/training-runs/README.md` | Đưa file đi cùng module. |
| `src/training-runs/dto/create-training-run.dto.ts` | `src/modules/training-runs/dto/create-training-run.dto.ts` | Đưa file đi cùng module. |
| `src/training-runs/schemas/training-run.schema.ts` | `src/modules/training-runs/schemas/training-run.schema.ts` | Đưa file đi cùng module. |
| `src/training-runs/training-runs.controller.ts` | `src/modules/training-runs/training-runs.controller.ts` | Đưa file đi cùng module. |
| `src/training-runs/training-runs.module.ts` | `src/modules/training-runs/training-runs.module.ts` | Đưa file đi cùng module. |
| `src/training-runs/training-runs.service.ts` | `src/modules/training-runs/training-runs.service.ts` | Đưa file đi cùng module. |
| `src/users/README.md` | `src/modules/users/README.md` | Đưa file đi cùng module. |
| `src/users/users.controller.ts` | `src/modules/users/users.controller.ts` | Đưa file đi cùng module. |
| `src/users/users.dto.ts` | `src/modules/users/dto/users.dto.ts` | Gom DTO của module. |
| `src/users/users.module.ts` | `src/modules/users/users.module.ts` | Đưa file đi cùng module. |
| `src/users/users.service.ts` | `src/modules/users/users.service.ts` | Đưa file đi cùng module. |

### File ngoài src

| File | Lý do |
|---|---|
| `README.md` | Trỏ link của sáu module sang `src/modules/`. |
| `BAO-CAO-CAP-NHAT-2026-11-03.md` | Cập nhật vị trí guard, controller, service, schema và spec được dẫn trong báo cáo. |
| `docs/AUTH-IMPLEMENTATION.md` | Cập nhật vị trí file cấu hình, helper, guard, các module và spec đã chuyển. |
| `docs/BAO-CAO-API-TIEU-LUAN.md` | Cập nhật đường dẫn trong bảng căn cứ API. |
| `docs/CAI-TIEN-QUY-TRINH-HOC-2026-11-14.md` | Cập nhật đường dẫn helper quyền sở hữu. |
| `docs/tt2.html` | Sửa 8 link tới source đã chuyển trong bản nháp cục bộ. |
| `docs/tt3.html` | Sửa 24 link tới source đã chuyển trong bản nháp cục bộ. |
| `test/app.e2e-spec.ts` | Import `configureApp` từ `src/config/`. |
| `test/run-browser-backend.mjs` | Import `configureApp` từ `dist/config/`. |
| `test/README.md` | Ghi mục đích của thư mục và các lệnh test từ `package.json`. |
| `test/unit/README.md` | Hướng dẫn đặt tên, vị trí và import cho unit test. |
| `test/e2e/README.md` | Hướng dẫn tên spec, MongoDB test và header bắt buộc của request ghi. |
| `AGENTS.md` | Ghi quy tắc báo cáo trước và sau mỗi lần sửa code. |
| `docs/changes/2026-11-15-restructure-src.md` | Lưu mốc và kết quả sắp xếp. |

Ba file đã có trong `test/` giữ vị trí. Hai bản nháp HTML đã sửa vẫn là file cục bộ chưa được Git theo dõi.

## Sau khi sửa

Giữ đủ **61/61 file gốc**, gồm **51 file TypeScript**. Tổng có **75 file** trong `src/` sau khi thêm **14 README**. `test/` có **6 file**, gồm ba file gốc và ba README.

```text
src/
  app.controller.spec.ts
  app.controller.ts
  app.module.ts
  app.service.ts
  common/
    guards/
      auth.guard.ts
      README.md
    README.md
  config/
    configure-app.ts
    database.config.ts
    README.md
    session.config.spec.ts
    session.config.ts
    upload.config.spec.ts
    upload.config.ts
  main.ts
  modules/
    datasets/
      datasets.controller.ts
      datasets.module.ts
      datasets.service.ts
      dto/
        create-dataset.dto.ts
        README.md
      README.md
      schemas/
        dataset.schema.ts
        README.md
    experiments/
      dto/
        create-experiment.dto.ts
        README.md
      experiments.controller.spec.ts
      experiments.controller.ts
      experiments.module.ts
      experiments.service.spec.ts
      experiments.service.ts
      README.md
      saved-snapshot.ts
      schemas/
        experiment.schema.ts
        README.md
    login/
      audit.service.ts
      dto/
        auth.dto.ts
        README.md
      login.controller.ts
      login.module.ts
      login.service.ts
      README.md
      schemas/
        audit.schema.ts
        README.md
        user.schema.ts
    README.md
    sync/
      dto/
        README.md
        sync.dto.ts
      README.md
      schemas/
        README.md
        sync-operation.schema.ts
      sync.controller.ts
      sync.module.ts
      sync.service.ts
    training-runs/
      dto/
        create-training-run.dto.ts
        README.md
      README.md
      schemas/
        README.md
        training-run.schema.ts
      training-runs.controller.ts
      training-runs.module.ts
      training-runs.service.ts
    users/
      dto/
        README.md
        users.dto.ts
      README.md
      users.controller.ts
      users.module.ts
      users.service.ts
  README.md
  shared/
    helpers/
      csv-validator.spec.ts
      csv-validator.ts
      ownership.ts
      pagination.ts
      README.md
      synthetic-config.validation.ts
    README.md
test/
  app.e2e-spec.ts
  cleanup-browser-backend.mjs
  e2e/
    README.md
  README.md
  run-browser-backend.mjs
  unit/
    README.md
```

`git diff --no-index` của hai danh sách route trả exit 0, diff rỗng. Cả hai danh sách có 27 route và cùng tiền tố `/api/v1`.

## Kiểm tra đã chạy

| Lệnh hoặc đối chiếu | Kết quả |
|---|---|
| `npx.cmd tsc --noEmit` | Exit 0, không có diagnostic. |
| `npm.cmd test` | Exit 0, Vitest 4.1.11, 6/6 file và 38/38 test đạt như mốc trước. |
| `npm.cmd run build` | Exit 0, `nest build` như mốc trước. |
| `npm.cmd run test:e2e` | Exit 0, 1/1 file và 21/21 test đạt với MongoDB tạm. Lần chạy trong sandbox bị `EACCES` khi kết nối loopback. Lần chạy lại có quyền kết nối cục bộ đã qua. |
| `npm run start:dev` và `GET /api/v1/health` | HTTP 200, nội dung có `"status":"ok"` và `"service":"hoi-quy-3d-api"`. Dùng `NODE_ENV=test` và MongoDB tạm `hoi-quy-3d-test`, sau đó dừng ứng dụng và MongoDB. |
| Đối chiếu từng file với commit mốc | 51 file TypeScript trong `src/` chỉ khác đường dẫn import tương đối và cách trình bày import. Cả ba file gốc trong `test/` đã được đối chiếu. Các import tương đối kiểm tra được đích và giữ đuôi `.js`. |
| Kiểm tra độ dài dòng import bị sửa | Tất cả nằm trong 80 cột. Prettier giữ ba import chỉ có một tên trên một dòng, nên ba dòng đó được xuống dòng thủ công. |
| `git grep` với các đường dẫn cũ | Exit 1, không có kết quả. Loại báo cáo này khỏi tìm kiếm vì bảng di chuyển cần lưu đường dẫn cũ. Kiểm tra riêng ba bản nháp HTML bằng `rg` cũng không có kết quả. |
| `git diff --check HEAD` | Exit 0. |
| Kiểm tra link README trong `src/` và `test/` | Cả 83 link tương đối trong 27 README đều trỏ tới đích tồn tại. |

### Kiểm tra README ở mọi thư mục

```powershell
$dirs = @('src','test') + @(Get-ChildItem -LiteralPath src,test -Directory -Recurse | ForEach-Object FullName)
$missing = @($dirs | Where-Object { !(Test-Path -LiteralPath (Join-Path $_ 'README.md') -PathType Leaf) })
if ($missing.Count -gt 0) { $missing; exit 1 }
"README.md: $($dirs.Count)/$($dirs.Count) directories covered (src/ and test/)."
```

```text
README.md: 27/27 directories covered (src/ and test/).
```

### Phạm vi của bộ chạy test, TypeScript và lint

| Cấu hình | Phạm vi đã đối chiếu |
|---|---|
| `vitest.config.ts` | `include: ['src/**/*.spec.ts']` chỉ tìm unit spec trong `src/`. |
| `vitest.config.e2e.ts` | `include: ['test/**/*.e2e-spec.ts']` bao gồm cả `test/e2e/`. |
| `tsconfig.json` | Phạm vi mặc định bao gồm file TypeScript dưới `test/`. `npx.cmd tsc --showConfig` liệt kê `./test/app.e2e-spec.ts`. |
| `tsconfig.build.json` | Chỉ build `src/`, loại `test` và `**/*spec.ts`. |
| `package.json` và `.oxlintrc.json` | Repo dùng Oxlint. Lệnh `oxlint --type-aware src/ test/` nhận toàn bộ `test/`, gồm cả `test/unit/` và `test/e2e/`. |

Để Vitest tìm cả unit spec mới, thay dòng `include` trong `vitest.config.ts` bằng dòng dưới đây.

```ts
include: ['src/**/*.spec.ts', 'test/unit/**/*.spec.ts'],
```

`git diff --exit-code HEAD` cho các file package, Vitest, TypeScript, Nest, Oxlint và triển khai trả exit 0.

## Không kiểm tra được

Chưa có spec tại `test/unit/` và `test/e2e/` để quan sát việc thu thập trực tiếp từ hai thư mục này. Phạm vi được đối chiếu từ cấu hình thực tế. Bộ e2e hiện có tại `test/app.e2e-spec.ts` đã chạy đủ 21 ca.

## Cách hoàn tác

Trên nhánh `restructure-src`, lệnh sau trả các file của đợt sắp xếp về commit mốc `0024b67`. Lệnh sẽ bỏ thay đổi đang có trong các đường dẫn được liệt kê.

```powershell
git restore --source=0024b67 --staged --worktree -- src/ test/ AGENTS.md README.md BAO-CAO-CAP-NHAT-2026-11-03.md docs/AUTH-IMPLEMENTATION.md docs/BAO-CAO-API-TIEU-LUAN.md docs/CAI-TIEN-QUY-TRINH-HOC-2026-11-14.md docs/changes/2026-11-15-restructure-src.md
```

Hai bản nháp HTML nằm ngoài Git. Nếu cần hoàn tác link trong hai file đó, đổi đích link từ cột **Mới** về cột **Cũ** theo bảng trên.

Sau khi hoàn tác, có thể trở về nhánh lúc bắt đầu bằng lệnh dưới đây.

```powershell
git switch codex/cai-thien-giao-dien-va-https
```
