# Hồi quy 3D

Web app trực quan hóa quá trình học của mô hình hồi quy trong không gian 3D.

- **Backend:** NestJS + TypeScript
- **Database:** MongoDB (Mongoose)
- **Frontend:** (sẽ bổ sung)

---

## 1. Chuẩn bị trước khi clone

Mỗi thành viên cần cài sẵn:

| Công cụ | Ghi chú | Kiểm tra bằng lệnh |
|---|---|---|
| Git | https://git-scm.com | `git --version` |
| Node.js bản LTS (20 trở lên) | https://nodejs.org | `node -v` |
| MongoDB Community Server + MongoDB Compass | https://www.mongodb.com/try/download/community | mở Compass, kết nối `mongodb://127.0.0.1:27017` |
| VS Code (khuyến nghị) | https://code.visualstudio.com | |

Cả nhóm dùng chung **npm** (không dùng yarn hay pnpm để tránh lệch file khóa).

### Quyền truy cập repo

Repo để chế độ **Private**. 

1. GitHub → repo → **Settings** → **Collaborators** → **Add people**.
2. Người được mời kiểm tra email và bấm **Accept invitation**.

Khi clone, GitHub sẽ đòi đăng nhập. Mật khẩu tài khoản GitHub **không dùng được**, hãy đăng nhập qua cửa sổ trình duyệt do Git mở ra (Git Credential Manager), hoặc dùng **Personal Access Token**:
GitHub → Settings → Developer settings → Personal access tokens → Generate new token → tick quyền `repo`. Dán token vào ô mật khẩu.

---

## 2. Clone và chạy lần đầu

### Bước 1: Clone repo

Mở Terminal (hoặc Git Bash) tại thư mục muốn lưu dự án:

```bash
git clone https://github.com/ManhCuong150206/TS-JS.git
cd TS-JS
```

### Bước 2: Cài thư viện

```bash
npm install
```

Lệnh này đọc `package.json` và tự tải mọi thư viện vào thư mục `node_modules`. Không cần gõ lại từng tên gói.

### Bước 3: Tạo file `.env`

File `.env` chứa cấu hình riêng của từng máy nên **không có trên GitHub**. Mỗi người tự tạo từ file mẫu `.env.example`:

**Windows (CMD):**
```bash
copy .env.example .env
```



Hoặc làm tay: chuột phải `.env.example` → Copy → Paste → đổi tên bản sao thành đúng `.env` (có dấu chấm đầu, không có đuôi nào khác).

### Bước 4: Điền nội dung `.env`

Mở file `.env` và ghi:

```dotenv
connection_string=mongodb://127.0.0.1:27017/hoi-quy-3d

```

Ý nghĩa:

| Biến | Ý nghĩa |
|---|---|
| `connection_string` | Địa chỉ MongoDB. Phần cuối `/hoi-quy-3d` là **tên database**, MongoDB sẽ tự tạo khi có dữ liệu đầu tiên |
| `PORT` | Cổng chạy server |

Lưu ý quan trọng:

- Tên biến trong `.env` phải **giống hệt** tên mà code đọc (`connection_string`), kể cả chữ hoa chữ thường.
- Tên database **phân biệt chữ hoa/thường**: `hoi-quy-3d` và `Hoi-Quy-3D` là hai database khác nhau.
- Dùng `127.0.0.1` thay cho `localhost` để tránh lỗi `ECONNREFUSED` trên Node bản mới.
- **Không có dấu cách** hai bên dấu `=`, không bọc giá trị trong dấu ngoặc.
- Sửa `.env` xong phải **tắt và chạy lại server** thì mới có tác dụng.



Nếu dùng MongoDB cài trên máy (`127.0.0.1`), dữ liệu của mỗi người **tách riêng**, không ai nhìn thấy dữ liệu của ai.

### Bước 5: Chạy server

Bảo đảm MongoDB trên máy đang chạy (mở Compass, kết nối được là ổn), rồi:

```bash
npm run start:dev
```

Chế độ này tự khởi động lại mỗi khi lưu file code. Mở trình duyệt vào:

```
http://localhost:3000
```

Thấy chữ **Hello World!** là chạy thành công. Tắt server bằng `Ctrl + C`.

---

## 3. Quy trình làm việc với Git (đọc kỹ)

### Nguyên tắc chung

- **Không ai push thẳng lên `main`.** Nhánh `main` luôn phải chạy được.
- Mỗi việc làm trên **một nhánh riêng**, xong thì tạo **Pull Request (PR)** để người khác xem rồi mới gộp.
- **Pull trước khi bắt đầu làm** để lấy code mới nhất của cả nhóm.
- Commit nhỏ, thường xuyên, mỗi commit một việc rõ ràng.
- **Không bao giờ commit file `.env`**.

### Quy trình hằng ngày (từng bước)

**Bước 1: Lấy code mới nhất về `main`**

```bash
git checkout main
git pull origin main
```

**Bước 2: Tạo nhánh mới cho việc của mình**

```bash
git checkout -b feature/ten-viec
```

Cách đặt tên nhánh:

| Loại việc | Mẫu tên | Ví dụ |
|---|---|---|
| Tính năng mới | `feature/...` | `feature/experiments-api` |
| Sửa lỗi | `fix/...` | `fix/loi-ket-noi-db` |
| Tài liệu | `docs/...` | `docs/cap-nhat-readme` |

Tên nhánh viết thường, không dấu, nối bằng gạch ngang.

**Bước 3: Viết code**

Làm việc bình thường, chạy `npm run start:dev` để thử.

**Bước 4: Xem mình đã sửa gì**

```bash
git status
```

Kiểm tra danh sách file: **không được có `.env`**, `node_modules` hay `dist`. Nếu thấy thì dừng lại, báo trưởng nhóm kiểm tra `.gitignore`.

**Bước 5: Commit**

```bash
git add .
git commit -m "feat: them API tao thi nghiem"
```

Mẫu nội dung commit (viết ngắn, nói rõ làm gì):

| Tiền tố | Dùng khi |
|---|---|
| `feat:` | Thêm tính năng |
| `fix:` | Sửa lỗi |
| `docs:` | Sửa tài liệu |
| `refactor:` | Sắp xếp lại code, không đổi chức năng |
| `test:` | Thêm hoặc sửa test |

**Bước 6: Cập nhật nhánh theo `main` mới nhất rồi push**

Trong lúc m làm, người khác có thể đã gộp code vào `main`. Kéo về trước khi push để phát hiện xung đột sớm:

```bash
git pull origin main
git push -u origin feature/ten-viec
```

Lần đầu push một nhánh mới thì dùng `-u`. Những lần sau trên cùng nhánh chỉ cần `git push`.

**Bước 7: Tạo Pull Request trên GitHub**

1. Vào trang repo, GitHub thường hiện nút vàng **Compare & pull request**, bấm vào. (Nếu không thấy: tab **Pull requests** → **New pull request** → chọn nhánh của mình.)
2. Đặt tiêu đề rõ ràng, mô tả ngắn đã làm gì và cách thử.
3. Ở mục **Reviewers**, chọn một bạn trong nhóm.
4. Bấm **Create pull request**.

**Bước 8: Review và gộp**

- Người review xem code, để lại nhận xét nếu cần. Người viết sửa rồi push tiếp lên cùng nhánh, PR tự cập nhật.
- Khi đã ổn: bấm **Merge pull request** → **Confirm merge**.
- Sau khi gộp có thể bấm **Delete branch** trên GitHub cho gọn.

**Bước 9: Dọn dẹp trên máy**

```bash
git checkout main
git pull origin main
git branch -d feature/ten-viec
```

Rồi quay lại Bước 2 cho việc kế tiếp.

---

## 4. Xử lý xung đột (conflict)

Xung đột xảy ra khi hai người cùng sửa **cùng một chỗ** của một file. Khi `git pull` báo `CONFLICT`, đừng hoảng:

1. Chạy `git status`, các file bị xung đột nằm trong mục **both modified**.
2. Mở file đó trong VS Code, tìm các đoạn có dạng:

```
<<<<<<< HEAD
code của m
=======
code của người khác
>>>>>>> origin/main
```

3. Quyết định giữ phần nào (hoặc gộp cả hai), rồi **xóa hẳn ba dòng đánh dấu** `<<<<<<<`, `=======`, `>>>>>>>`. VS Code có các nút **Accept Current / Accept Incoming / Accept Both** ngay trên đoạn xung đột.
4. Lưu file, rồi:

```bash
git add .
git commit -m "fix: giai quyet xung dot voi main"
git push
```

Nếu không chắc nên giữ code nào, **hỏi người kia** trước khi chọn. Đừng xóa bừa.

Cách giảm xung đột: chia việc để mỗi người sửa file riêng, và pull thường xuyên.

---

## 5. Các lệnh Git hay dùng

| Lệnh | Tác dụng |
|---|---|
| `git status` | Xem file nào đã sửa, file nào chuẩn bị commit |
| `git branch` | Liệt kê nhánh trên máy (dấu `*` là nhánh đang đứng) |
| `git checkout ten-nhanh` | Chuyển sang nhánh khác |
| `git log --oneline` | Xem lịch sử commit gọn |
| `git diff` | Xem chi tiết dòng nào đã sửa (chưa add) |
| `git restore ten-file` | Bỏ các sửa đổi chưa commit của một file |
| `git stash` / `git stash pop` | Cất tạm thay đổi để chuyển nhánh, rồi lấy lại |
| `git remote -v` | Xem repo đang nối tới đâu |

---

## 6. Cấu trúc thư mục

```
.
├── src/
│   ├── main.ts              điểm khởi động server
│   ├── app.module.ts        module gốc: đọc .env, mở kết nối MongoDB
│   ├── app.controller.ts
│   ├── app.service.ts
│   └── <ten-module>/        mỗi tính năng một thư mục
│       ├── *.module.ts      khai báo module
│       ├── *.controller.ts  nhận request HTTP
│       ├── *.service.ts     xử lý logic, làm việc với DB
│       └── *.schema.ts      mô tả dữ liệu trong MongoDB
├── test/                    test e2e
├── .env                     cấu hình riêng từng máy (KHÔNG commit)
├── .env.example             file mẫu cấu hình (có commit)
└── package.json
```

Quy ước thêm module mới:

```bash
nest g module ten-module
nest g service ten-module
nest g controller ten-module
```

---

## 7. Lỗi thường gặp

| Thông báo / hiện tượng | Nguyên nhân và cách xử lý |
|---|---|
| `Missing script: "start:dev"` | Đang đứng sai thư mục. `cd` vào thư mục chứa `package.json` |
| `Cannot find module ...` | Chưa chạy `npm install` |
| `MongooseServerSelectionError` / `ECONNREFUSED` | MongoDB chưa chạy hoặc sai địa chỉ trong `.env`. Mở Compass thử kết nối. Dùng `127.0.0.1` thay `localhost` |
| `bad auth` / `Authentication failed` | Sai user hoặc mật khẩu trong chuỗi kết nối Atlas |
| Timeout khi dùng Atlas | Chưa mở IP ở Atlas → Network Access |
| `Nest can't resolve dependencies ... DatabaseConnection` | Thiếu `MongooseModule.forRootAsync` trong `app.module.ts` |
| API trả về `[]` dù database có dữ liệu | Sai tên database (hoa/thường) trong `.env`, hoặc schema sai tên collection (cần `@Schema({ collection: 'ten-collection' })`) |
| `EADDRINUSE: port 3000` | Cổng 3000 đang bị chương trình khác dùng. Tắt nó hoặc đổi `PORT` trong `.env` |
| Sửa `.env` mà không thấy đổi | Phải tắt (`Ctrl + C`) và chạy lại `npm run start:dev` |
| `git push` bị `rejected` | Có người đã push trước. Chạy `git pull origin main` rồi push lại |
| Git hỏi tên và email khi commit | `git config --global user.name "Ten cua ban"` và `git config --global user.email "email-github"` |
| Lỡ `git add` file `.env` | Chạy `git rm --cached .env` rồi commit. Nếu đã push chuỗi có mật khẩu: **đổi mật khẩu database ngay** |

---

## 8. Quy ước chung của nhóm

- Không push thẳng lên `main`. Mọi thay đổi đi qua Pull Request.
- Không commit `.env`, `node_modules`, `dist`.
- Thay đổi cấu trúc dữ liệu (schema) hoặc API phải **báo cả nhóm** trước khi gộp, vì Frontend và Tester phụ thuộc vào đó.
- Một việc xong khi: code chạy được, có hướng dẫn thử, và đã được một người review.
- Gặp lỗi thì copy **nguyên văn** thông báo lỗi gửi vào nhóm, kèm lệnh đã chạy. Nhớ **che mật khẩu** nếu có.

## Lưu thí nghiệm, xác thực và kiểm thử tích hợp (03/11/2026)

- FE gọi cùng origin `/api/v1`; Angular dev proxy chuyển tới NestJS `127.0.0.1:3000`. Chạy Backend trước bằng `npm run start:dev`, rồi FE bằng `npm start`. Bản FE SSR chuyển API tới `BACKEND_ORIGIN` (mặc định cùng địa chỉ Backend); không trả HTML thay cho phản hồi API.
- Đăng ký/đăng nhập/Guest dùng `/api/v1/auth/register`, `/login`, `/guest`, `/session`, `/logout`. Mật khẩu dùng scrypt với salt riêng, session token ngẫu nhiên chỉ lưu bản hash phía server. Trình duyệt nhận cookie HttpOnly/SameSite=Lax; token không nằm trong localStorage. Không còn chấp nhận `x-user-id` hoặc Bearer chứa ID tự khai. Header `X-Expected-User` chỉ dùng đối chiếu với phiên đã xác thực, không cấp quyền.
- Mọi dataset, experiment, training run và sync chỉ truy cập dữ liệu của chủ phiên. Guest có ID riêng, không dùng chung anonymous_user. Bản ghi cũ chưa có chủ sở hữu hợp lệ không được tự mở cho mọi người; cần migration có kiểm soát nếu muốn nhập lại dữ liệu cũ.
- Bulk experiment lưu đủ trọng số, bias, iteration, tham số, metric, loại dữ liệu và CSV đã xử lý. Mỗi bản ghi có mutationId và serverVersion; phản hồi items xác nhận từng mutation. Xóa offline dùng tombstone; đọc danh sách `includeDeleted=true` để kéo cả các lần xóa. Xung đột trả 409, không tự ghi đè.
- Giới hạn bản lưu 8 MiB, JSON request 10 MiB, mỗi lô tối đa 100 bản ghi. FE tự chia lô theo dung lượng. Snapshot CSV quá lớn bị báo lỗi trước khi lưu; API upload file hiện có giới hạn 10 MiB, không thay thế tự động giới hạn snapshot. File chỉ được gắn qua upload của server; metadata/sync không được tự gán storage key để tải tệp khác.
- Production phải dùng HTTPS cổng 443 và `NODE_ENV=production` để cookie có cờ Secure; cấu hình `CORS_ORIGINS` đúng origin triển khai. Đợt này chưa xác minh chứng chỉ hoặc triển khai TLS thật. Chưa có xác minh email/quên mật khẩu/2FA.

Kiểm tra: `npm test` chạy unit; `npm run test:e2e` chạy API thật với MongoDB đang hoạt động, tự tạo database `regression_test_<random>` và chỉ dọn đúng database đó. Không dùng database ứng dụng cho test. `node test/run-browser-backend.mjs` mở API test riêng trên cổng 3000 với database `regression_browser_<random>` để chạy browser FE; dừng tiến trình này rồi chạy `node test/cleanup-browser-backend.mjs` để dọn đúng database test đã ghi trong output. Không chạy helper nếu cổng 3000 đang phục vụ Backend thật.

Chi tiết FE và giới hạn: `FE/FE-hoiquy3d/docs/CONG-NGHE-VA-HIEU-UNG.md` trong repo FE riêng.

Bảng thay đổi từng file và hướng dẫn cho người mới: [Báo cáo cập nhật 03/11/2026](BAO-CAO-CAP-NHAT-2026-11-03.md).
