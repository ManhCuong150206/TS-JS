# Schema của experiments

`experiment.schema.ts` định nghĩa document Mongoose trong collection `experiments`. Đây là cấu trúc dữ liệu lưu trong MongoDB; DTO là cấu trúc request nhận từ frontend.

Các nhóm trường chính:

- `clientId`: mã chuỗi duy nhất do client tạo, hỗ trợ upsert/sync offline.
- `name`, `description`, `status`: thông tin và trạng thái thí nghiệm.
- `datasetId`: tham chiếu ObjectId tới document Dataset.
- `algorithm`: loại, phiên bản và cấu hình riêng của thuật toán.
- `targetColumn`, `featureColumns`: cột mục tiêu và đặc trưng.
- `preprocessing`, `split`: cách xử lý dữ liệu và chia train/test.
- `ownerId`, `syncVersion`, `deletedAt`: chủ sở hữu hiện tại, phiên bản đồng bộ và thời điểm xóa mềm.
- `createdAt`, `updatedAt`: thời gian do Mongoose quản lý.

Schema định nghĩa kiểu và index; các quy tắc như cấu hình thuật toán hợp lệ được kiểm tra thêm trong service.
