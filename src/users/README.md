# Users — hồ sơ và vòng đời tài khoản

[Về mục lục backend](../README.md) · [Đăng nhập](../login/README.md)

## Phạm vi

`UsersModule` cho người dùng đã đăng nhập xem/sửa tên hiển thị, đổi mật khẩu và tự xóa tài khoản. Module dùng chung collection `users` của LoginModule, không tạo collection người dùng riêng.

Controller hiện tại chỉ công bố các route `/users/me`. **Không có API danh sách user, sửa role/status hay xóa user khác dưới `/users/:id`**, kể cả khi service còn có hàm nhận ID hoặc tài liệu/test cũ nhắc tới quản trị.

## API và quyền truy cập

Mọi đường dẫn dưới đây có tiền tố `/api/v1`. Mọi request cần cookie `hq3d.sid` hợp lệ. POST/DELETE cần `X-Requested-With: XMLHttpRequest`; body JSON cần `Content-Type: application/json`.

| Method, route | Body | Kết quả HTTP 200 |
|---|---|---|
| `GET /users/me` | Không có | Thông tin tài khoản đang đăng nhập |
| `POST /users/me` | `{ "displayName": "Tên mới" }` | Tài khoản sau cập nhật |
| `POST /users/me/password` | `{ "currentPassword": "...", "newPassword": "..." }` | Tài khoản sau đổi mật khẩu |
| `DELETE /users/me` | `{ "password": "..." }` | `{ "success": true }`, đồng thời hủy phiên |

Kết quả tài khoản gồm `_id`, `email`, `displayName`, `role`, `status`, `createdAt`, `updatedAt`. Mật khẩu/hash và phiên bản phiên không được trả về. `GET /users/me` và `GET /auth/me` cùng trả dạng thông tin này.

## Đầu vào hợp lệ

- `displayName` được trim, phải là chuỗi dài 1–120 ký tự sau trim.
- `currentPassword`, `newPassword`, `password` phải là chuỗi 8–72 ký tự và tối đa 72 byte UTF-8. Mật khẩu không được trim.
- Trường ngoài DTO bị trả 400, ví dụ gửi `email`, `role` hoặc `ownerId` vào cập nhật hồ sơ. API hiện không hỗ trợ đổi email.
- ID tài khoản thao tác lấy từ phiên, không lấy từ request body.

## Ví dụ cập nhật tên

Sau khi đăng nhập qua [LoginModule](../login/README.md):

```js
const response = await fetch('http://localhost:3000/api/v1/users/me', {
  method: 'POST',
  credentials: 'include',
  headers: {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  },
  body: JSON.stringify({ displayName: 'Nguyễn An' }),
});
if (!response.ok) throw new Error(await response.text());
const updatedAccount = await response.json();
```

Đổi mật khẩu dùng cùng cấu hình fetch, đổi URL thành `/users/me/password` và body thành `currentPassword/newPassword`. Xóa tài khoản dùng method `DELETE`, URL `/users/me` và body chứa mật khẩu hiện tại; thao tác này thực sự xóa tài khoản nên chỉ thực hiện khi có chủ ý.

## Đổi mật khẩu ảnh hưởng phiên như thế nào?

1. Tìm tài khoản active có `sessionVersion` khớp với request hiện tại.
2. So sánh mật khẩu hiện tại bằng bcrypt.
3. Băm mật khẩu mới với cost 12; cập nhật có điều kiện phiên bản để tránh ghi từ phiên đã cũ.
4. Tăng `sessionVersion` của tài khoản lên 1, ghi audit `password.change`.
5. Cập nhật phiên đang thực hiện thao tác sang phiên bản mới và lưu session.

Kết quả: phiên hiện tại tiếp tục hoạt động, các phiên khác bị 401 ở request được bảo vệ tiếp theo. Mật khẩu cũ không đăng nhập được nữa. Code không bắt buộc mật khẩu mới khác mật khẩu cũ.

## Tự xóa tài khoản

Trước tiên người dùng phải xác nhận mật khẩu. Service kiểm tra không xóa admin active cuối cùng, sau đó thực hiện:

1. Đánh dấu tài khoản `disabled` và tăng `sessionVersion` để vô hiệu hóa phiên.
2. Với dataset, experiment và training run có `ownerId` của tài khoản và chưa bị xóa: đặt `deletedAt`, tăng `syncVersion`.
3. Xóa document tài khoản khỏi `users`.
4. Ghi audit `account.delete`, hủy phiên hiện tại và xóa cookie.

Dữ liệu nghiệp vụ được **xóa mềm**, còn tài khoản bị xóa khỏi collection. File CSV vật lý không bị xóa bởi luồng này; audit log và sync operation cũng không bị dọn. Không có API phục hồi tài khoản ở đây.

Các bước không nằm trong MongoDB transaction. Nếu DB lỗi giữa chừng, có thể còn dữ liệu cần xử lý và tài khoản đã bị khóa. Hàng đợi trong service chỉ tuần tự hóa các thao tác qua cùng instance trong một tiến trình; không phải khóa phân tán giữa nhiều server. Controller hiện không có route quản trị để gọi xóa lại tài khoản khác.

## Phụ thuộc và cấu trúc

| File/Module | Vai trò |
|---|---|
| `users.controller.ts` | HTTP, nhận current user, quản lý phiên sau đổi mật khẩu/xóa |
| `users.dto.ts` | Validate ba loại request |
| `users.service.ts` | Hồ sơ, bcrypt, bảo vệ admin cuối, xóa dữ liệu liên quan |
| `users.module.ts` | Nạp DatasetsModule, ExperimentsModule, TrainingRunsModule để dùng model |
| LoginModule/global AuthGuard | Cung cấp model User, AuditService và kiểm tra đăng nhập |

## Lỗi và kiểm tra

| Mã | Ý nghĩa |
|---|---|
| 400 | DTO sai/trường thừa hoặc cố xóa admin active cuối cùng |
| 401 | Phiên không hợp lệ, sai mật khẩu, tài khoản/phiên thay đổi trong lúc xử lý |
| 403 | Header hoặc Origin không hợp lệ |
| 404 | Route không tồn tại; hàm service tìm ID cũng trả 404 nếu không thấy user |

Các tình huống cần kiểm tra khi thay đổi module: tên rỗng sau trim, mật khẩu Unicode quá 72 byte, đổi mật khẩu giữ phiên hiện tại nhưng chặn phiên khác, xác nhận mật khẩu trước xóa, xóa mềm cả ba nhóm dữ liệu, bảo vệ admin cuối. Bộ kiểm thử nằm trong `test/app.e2e-spec.ts`, chạy từ gốc bằng `npm run test:e2e`; một số test quản trị cũ đang nhắm tới route không còn trong controller.
