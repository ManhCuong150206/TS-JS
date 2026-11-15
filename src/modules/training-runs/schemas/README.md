# schemas

## Mục đích

Định nghĩa document Mongoose lưu kết quả và lịch sử huấn luyện.

## Chứa gì

| File | Vai trò |
|---|---|
| [training-run.schema.ts](training-run.schema.ts) | Schema `TrainingRun`, metrics, các điểm lịch sử và index của collection `trainingRuns` |

## Quan hệ

`TrainingRunsModule` đăng ký schema. Các service training-runs, sync và users dùng model cho các thao tác dữ liệu tương ứng.

## Lưu ý khi sửa

Đối chiếu các trường liên kết experiment, chủ sở hữu và xóa mềm khi đổi schema.
