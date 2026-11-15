# helpers

## Mục đích

Chứa các hàm kiểm tra đầu vào và dựng bộ lọc dùng trong nghiệp vụ.

## Chứa gì

| File | Vai trò |
|---|---|
| [csv-validator.ts](csv-validator.ts) | Phân tích CSV, suy luận kiểu cột và tạo metadata |
| [csv-validator.spec.ts](csv-validator.spec.ts) | Kiểm tra phân tích CSV |
| [ownership.ts](ownership.ts) | Tạo bộ lọc theo chủ sở hữu và ID, lọc trường payload |
| [pagination.ts](pagination.ts) | Kiểm tra và tính tham số phân trang |
| [synthetic-config.validation.ts](synthetic-config.validation.ts) | Kiểm tra cấu hình tạo dữ liệu tổng hợp |

## Quan hệ

Datasets dùng bộ kiểm tra CSV. Các luồng tài nguyên dùng bộ lọc quyền sở hữu. Experiments và sync dùng bộ kiểm tra cấu hình tổng hợp.

## Lưu ý khi sửa

Đối chiếu nơi gọi khi sửa quy tắc kiểm tra hoặc trường được phép ghi. Chạy `npm test -- src/shared/helpers/csv-validator.spec.ts` khi sửa phân tích CSV.
