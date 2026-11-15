# DTO của experiments

DTO (Data Transfer Object) mô tả hình dạng dữ liệu mà API nhận từ frontend. Các class hiện tại chủ yếu khai báo kiểu TypeScript; kiểm tra quy tắc nghiệp vụ được thực hiện trong `ExperimentsService`.

## `create-experiment.dto.ts`

- `CreateExperimentDto`: tên, datasetId, thuật toán/cấu hình, cột mục tiêu, cột đặc trưng, tiền xử lý và cấu hình chia train/test.
- `UpdateExperimentDto`: các trường tùy chọn để cập nhật một phần.

`algorithm.type` quyết định cấu hình cần thiết: Polynomial cần `degree`; Ridge/Lasso cần `lambda`; Linear cho phép chọn solver. FE gửi bốn tên loại `linear`, `polynomial`, `ridge`, `lasso`.

Khi thêm DTO mới, cần cập nhật controller/service tương ứng và bổ sung validation tự động nếu muốn request sai bị từ chối trước khi vào service.
