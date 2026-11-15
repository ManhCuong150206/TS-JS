# dto

## Mục đích

Mô tả dữ liệu tạo một lần huấn luyện.

## Chứa gì

| File | Vai trò |
|---|---|
| [create-training-run.dto.ts](create-training-run.dto.ts) | Định nghĩa `CreateTrainingRunDto` gồm experiment, thuật toán, cấu hình, metrics và lịch sử |

## Quan hệ

`TrainingRunsController` nhận DTO và `TrainingRunsService` dùng DTO để tạo run. DTO lấy kiểu thuật toán và trạng thái từ schema.

## Lưu ý khi sửa

Đối chiếu kiểu DTO với trường lưu trong schema và phép kiểm tra experiment trong service.
