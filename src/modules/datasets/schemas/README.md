# schemas

## Mục đích

Định nghĩa document Mongoose lưu metadata dataset.

## Chứa gì

| File | Vai trò |
|---|---|
| [dataset.schema.ts](dataset.schema.ts) | Schema `Dataset`, thông tin cột, thông tin lưu trữ và index của collection `datasets` |

## Quan hệ

`DatasetsModule` đăng ký schema. Service của datasets, experiments, sync và users truy vấn model dataset.

## Lưu ý khi sửa

Kiểm tra index và cách truy vấn `ownerId`, `clientId` khi sửa schema.
