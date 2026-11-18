# Performance testing với k6

## Mục tiêu và an toàn

k6 tạo nhiều virtual users (VU) gửi HTTP request để đo response time, throughput và lỗi ở mức API. Bộ này chỉ cho phép chạy trên localhost/test environment qua `run-k6.ps1`; không dùng production. Không có credential, các scenario chỉ gọi health công khai. Có credential, chúng thêm các GET đi qua session/MongoDB. Token, password và Mongo URI không được ghi vào test/report.

`health` không kiểm tra MongoDB. Để đánh giá database qua API, dùng `baseline`, `api`, `load` với **tài khoản test riêng**; HTTP latency là độ trễ end-to-end, không phải thời gian query MongoDB thuần. Muốn biết query cụ thể, bật MongoDB profiler/explain ở môi trường test theo hướng dẫn MongoDB, không thay index/drop collection.

## Cài một lần trên Windows

Tại thư mục gốc backend (`TS-JS-restructure-src`):

```powershell
npm ci
winget install -e --id Grafana.k6
```

Đóng/mở PowerShell rồi xác minh:

```powershell
k6 version
npm test
```

`npm ci` là lựa chọn đúng cho folder mới vì cài đúng phiên bản trong `package-lock.json`; không cần `npm install` sau đó trừ khi bạn thay đổi `package.json`.

## Khởi động MongoDB và backend

Tạo `.env` cục bộ từ `.env.example` (không commit), điền URI của database test/local và session secret. Ví dụ URI local không auth: `MONGODB_URI=mongodb://127.0.0.1:27017/hoi-quy-3d-test`. Sau đó:

```powershell
npm run start:dev
Invoke-WebRequest http://127.0.0.1:3000/api/v1/health
```

Không trỏ `MONGODB_URI` đến production. Nếu dùng Docker, tạo `.env.compose` theo `.env.compose.example` và chỉ chạy khi đã điền toàn bộ secret bắt buộc.

## Unit test: từng bước

```powershell
npm ci
npm test
npm run test:cov
```

Test hiện hữu là unit test của controller/service/helper/config. E2E không được chạy bởi `npm test`; nó dùng `mongodb-memory-server` và chạy riêng bằng `npm run test:e2e` khi cần.

## k6: từng bước

Từ root backend, chỉ smoke (an toàn, public):

```powershell
.\test\performance\scripts\run-smoke.ps1
```

Baseline không credential (chỉ health):

```powershell
.\test\performance\scripts\run-k6.ps1 -Scenario baseline -VUs 1
```

Đặt credential của tài khoản test chỉ cho phiên PowerShell hiện tại, rồi chạy API/load an toàn:

```powershell
$env:K6_TEST_EMAIL = 'k6-test@example.local'
$env:K6_TEST_PASSWORD = 'password-cua-tai-khoan-test'
.\test\performance\scripts\run-k6.ps1 -Scenario api -VUs 5 -Duration 30s
.\test\performance\scripts\run-k6.ps1 -Scenario load
```

`run-all.ps1` chạy smoke, baseline, api, load; mặc định không chạy stress/spike/soak/write:

```powershell
.\test\performance\scripts\run-all.ps1 -VUs 5 -Duration 30s
```

Chạy các bài tải cao sau khi đã xem baseline/load và theo dõi CPU/RAM/MongoDB:

```powershell
$env:K6_STRESS_MAX_VUS = '50'
.\test\performance\scripts\run-k6.ps1 -Scenario stress
.\test\performance\scripts\run-k6.ps1 -Scenario spike
.\test\performance\scripts\run-k6.ps1 -Scenario soak
```

Write smoke bị khóa hai lớp và chỉ cleanup ID nó vừa tạo. Không chạy nếu không có test account/database riêng:

```powershell
$env:K6_ALLOW_WRITES = 'true'
$env:K6_TEST_PREFIX = 'k6-20261117'
.\test\performance\scripts\run-k6.ps1 -Scenario write-smoke
```

## Kết quả và cách đọc

Mỗi lần chạy tạo ba file timestamp trong `test/performance/reports/`: raw event JSON, summary JSON và log. Đây là số liệu thực đo, không có report mẫu điền sẵn. `http_req_duration` có average/median/P90/P95/P99; P95 nghĩa là 95% request nhanh hơn hoặc bằng mốc đó. `http_req_failed`, `checks`, status code trong raw JSON cho biết lỗi. So sánh P95 và error rate giữa baseline/load/stress; P95 tăng mạnh khi tăng VU là tín hiệu cần kiểm tra CPU/RAM backend, MongoDB slow query/connections và máy chạy k6.

Endpoint, auth, thao tác MongoDB và phạm vi test có trong [API-INVENTORY.md](docs/API-INVENTORY.md).
