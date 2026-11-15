# dto

## Mục đích

Mô tả dữ liệu đầu vào để tạo metadata dataset.

## Chứa gì

| File | Vai trò |
|---|---|
| [create-dataset.dto.ts](create-dataset.dto.ts) | Định nghĩa `CreateDatasetDto` gồm tên, nguồn dữ liệu, cột, dữ liệu xem trước và cấu hình sinh dữ liệu |

## Quan hệ

`DatasetsController` nhận DTO và `DatasetsService` dùng nó khi tạo dataset.

## Lưu ý khi sửa

Đối chiếu các trường API với danh sách trường mà service cho phép ghi.
