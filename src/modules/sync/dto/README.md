# dto

## Mục đích

Mô tả yêu cầu đồng bộ theo lô và kết quả của từng thao tác.

## Chứa gì

| File | Vai trò |
|---|---|
| [sync.dto.ts](sync.dto.ts) | Định nghĩa phần tử thao tác, request batch, kết quả thao tác và response batch |

## Quan hệ

`SyncController` nhận batch và `SyncService` xử lý các thao tác. DTO dùng kiểu entity và hành động từ schema sync.

## Lưu ý khi sửa

Khi sửa payload, đối chiếu `operationId`, `idempotencyKey`, `entityClientId` và kết quả đồng bộ.
