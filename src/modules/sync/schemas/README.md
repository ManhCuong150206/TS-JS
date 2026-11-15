# schemas

## Mục đích

Định nghĩa document Mongoose cho các thao tác đồng bộ đã xử lý.

## Chứa gì

| File | Vai trò |
|---|---|
| [sync-operation.schema.ts](sync-operation.schema.ts) | Schema `SyncOperation`, các kiểu entity/hành động/trạng thái và index của collection `syncOperations` |

## Quan hệ

`SyncModule` đăng ký schema và `SyncService` lưu, tra cứu thao tác khi xử lý batch.

## Lưu ý khi sửa

Khi đổi index, đối chiếu cách service phân biệt chủ sở hữu và phát hiện thao tác gửi lại.
