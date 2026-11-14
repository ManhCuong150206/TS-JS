# Sync — gửi thao tác offline và lấy thay đổi từ server

[Về mục lục backend](../README.md) · [Datasets](../datasets/README.md) · [Experiments](../experiments/README.md) · [Training runs](../training-runs/README.md)

## Mục đích

`SyncModule` giúp client đã làm việc offline gửi các thao tác tạo/sửa/xóa lên server và lấy dữ liệu thay đổi về. Module hỗ trợ ba loại thực thể: `dataset`, `experiment`, `trainingRun`. Nó ghi trực tiếp qua model Mongoose, không gọi toàn bộ luồng CRUD service của từng module.

Ba khái niệm cần phân biệt:

- `entityClientId`: ID ổn định của **bản ghi**, dùng để tìm nó qua nhiều lần đồng bộ.
- `idempotencyKey`: ID của **một thao tác gửi**, giữ nguyên khi retry cùng thao tác để hạn chế thực hiện lại.
- `clientVersion`: phiên bản server mà client biết khi sửa; server lưu phiên bản ở `syncVersion`.

Đây là API lưu dữ liệu, không phải đồng bộ tệp CSV vật lý hoặc chạy thuật toán. Payload dataset chỉ mang metadata; upload CSV sử dụng [DatasetsModule](../datasets/README.md).

## API và xác thực

| Endpoint đầy đủ | Đầu vào | Kết quả |
|---|---|---|
| `POST /api/v1/sync/batch` | JSON `{ "operations": [...] }` | HTTP 201, `{ success, syncedAt, results }` |
| `GET /api/v1/sync/changes?since=<ISO time>` | Mốc thời gian tùy chọn | HTTP 200, `{ serverTime, since, changes }` |

Cả hai yêu cầu cookie phiên hợp lệ; user thường chỉ truy cập dữ liệu của mình, admin áp dụng quyền rộng hơn từ `ownerFilter/assertOwner`. POST cần `Content-Type: application/json` và `X-Requested-With: XMLHttpRequest`. Frontend dùng `credentials: 'include'`.

## Cấu trúc một operation

| Trường | Ý nghĩa và kiểm tra hiện tại |
|---|---|
| `operationId` | Chuỗi client dùng nối kết request với kết quả; service chỉ kiểm tra kiểu string |
| `idempotencyKey` | Chuỗi không rỗng; server hash cặp `[userId, key]` trước khi lưu để tách khóa theo user |
| `entityType` | `dataset`, `experiment`, `trainingRun` |
| `entityClientId` | Chuỗi không rỗng, lưu/tìm ở `clientId` của thực thể |
| `action` | `create`, `update`, `delete` |
| `payload` | Object dữ liệu nghiệp vụ; khi delete có thể gửi `{}` |
| `clientVersion` | Số nguyên; code hiện không bắt buộc dương |
| `clientUpdatedAt` | Có trong DTO nhưng hiện không dùng để phân xử xung đột |

Payload được lọc theo danh sách trường cho phép của từng thực thể. Các trường server quản lý như owner, timestamps, `syncVersion`, `deletedAt`, storage path không được ghi đè. Tham chiếu `datasetId` của experiment và `experimentId` của run, nếu gửi, phải trỏ tới dữ liệu chưa xóa và được phép truy cập; server đổi `_id/clientId` đầu vào thành ObjectId.

## Ví dụ gửi một dataset offline

Body cho POST batch, dùng ID mới khi thử tạo dữ liệu độc lập:

```json
{
  "operations": [
    {
      "operationId": "op-dataset-create-001",
      "idempotencyKey": "request-dataset-create-001",
      "entityType": "dataset",
      "entityClientId": "dataset-offline-001",
      "action": "create",
      "clientVersion": 0,
      "payload": {
        "name": "Dataset offline",
        "sourceType": "generated",
        "generationConfig": { "seed": 42 }
      }
    }
  ]
}
```

Kết quả thành công có dạng sau (thời gian minh họa):

```json
{
  "success": true,
  "syncedAt": "2026-11-14T09:00:00.000Z",
  "results": [{
    "operationId": "op-dataset-create-001",
    "idempotencyKey": "request-dataset-create-001",
    "entityType": "dataset",
    "entityClientId": "dataset-offline-001",
    "status": "applied",
    "serverVersion": 1
  }]
}
```

Sửa tiếp dataset: giữ `entityClientId`, tạo `operationId/idempotencyKey` mới, gửi `action: update`, `clientVersion: 1` và payload cần đổi. Gửi lại request bị mất response thì giữ nguyên key của thao tác cũ.

## Xử lý batch và ý nghĩa kết quả

Operations được xử lý **tuần tự theo thứ tự mảng**. Đặt tạo dataset trước experiment, experiment trước run nếu chúng tham chiếu nhau. Mỗi operation có thể thành công/thất bại riêng; batch không phải transaction.

| `status` | Ý nghĩa | Client nên làm gì |
|---|---|---|
| `applied` | Server đã thực hiện | Ghi nhận phiên bản nếu response có, sau đó pull để đối chiếu |
| `duplicate` | Đã gặp key hoặc bản ghi tạo tương ứng | Không mặc định coi payload hiện tại đã được ghi; pull lại dữ liệu |
| `conflict` | Bản server mới hơn ở nhánh có kiểm tra version | Đọc `conflict.serverData`, hòa giải rồi gửi thao tác mới/key mới |
| `error` | Không áp dụng được thao tác | Đọc `error`, sửa dữ liệu/quyền/tham chiếu trước khi thử lại |

`success` chỉ true khi mọi kết quả là `applied` hoặc `duplicate`; HTTP thành công không có nghĩa mọi operation đều áp dụng. `conflict` gồm `reason`, `serverVersion`, `serverData`.

Nếu body không có mảng operations hoặc một operation sai cấu trúc tối thiểu, API ném 400. Kiểm tra từng operation nằm trong vòng lặp nên những operation trước đó có thể đã ghi dù request sau cùng nhận 400. Lỗi trong bước xử lý/lưu được chuyển thành kết quả `error` với thông báo chung để tránh lộ dữ liệu.

## Hành vi từng loại thực thể

| Thao tác | Experiment | Dataset | Training run |
|---|---|---|---|
| Create chưa tồn tại | Tạo mới, version 1 | Tạo mới, version 1 | Tạo mới, version 1 |
| Create đã tồn tại | Conflict nếu serverVersion lớn hơn clientVersion; trường hợp còn lại vẫn thử create và có thể lỗi unique | Duplicate | Duplicate |
| Update chưa tồn tại | Tạo mới nếu payload đủ hợp lệ | Tạo mới nếu payload đủ hợp lệ | Error |
| Update đã tồn tại | Conflict khi serverVersion > clientVersion; nếu không thì sửa và tăng version | Cùng quy tắc experiment | Sửa và tăng version, **không kiểm tra xung đột version** |
| Delete chưa tồn tại | Applied | Applied | Applied |
| Delete đã tồn tại | Xóa mềm và tăng version | Xóa mềm và tăng version | Xóa mềm và tăng version |

Các nhánh delete không kiểm tra version trước xóa. Bản ghi đã có `deletedAt` bị từ chối ở bước kiểm tra ban đầu, không được phục hồi bằng create/update. Trường hợp retry cùng key đã có log sẽ trả duplicate trước bước này. Delete dataset/run có thể không trả `serverVersion` dù dữ liệu đã tăng version.

Experiment sync kiểm tra cấu hình synthetic qua validator dùng chung, nhưng không đi qua toàn bộ ExperimentsService. Run sync tạo mới phải gửi `algorithmVersion` theo schema; không được hưởng mặc định `1.0.0` của API POST training-runs. Do đó không xem payload sync và payload CRUD là hai luồng xử lý hoàn toàn tương đương.

## Idempotency và giới hạn hiện tại

Collection `syncOperations` lưu operation ID, key đã hash unique, loại/ID thực thể, action, version, status, owner, lý do/snapshot khi conflict và timestamps. Schema còn có enum `rejected`, nhưng kết quả public hiện chỉ có bốn status ở bảng trên.

Khi key đã tồn tại, server trả `duplicate` với phiên bản lưu trước đó, không so sánh payload mới và không trả lại nguyên kết quả cũ. Điều này cũng áp dụng cho key của conflict đã được ghi log; sau hòa giải phải dùng key mới. Phiên bản trong log dùng giá trị 1 khi kết quả không cung cấp version, nên pull là cách xác minh dữ liệu thực tế.

Ghi thực thể và ghi log là hai bước riêng, không có transaction/khóa đồng thời. Nếu ghi log thất bại sau khi thay đổi dữ liệu, response có thể là error dù dữ liệu đã đổi. Hai request đồng thời cùng key hoặc cùng version không được bảo đảm xử lý exactly-once. Cần hiểu giới hạn này khi thiết kế retry.

## Pull thay đổi

`GET /api/v1/sync/changes` không có `since` sẽ lấy từ Unix epoch; nếu có thì server parse thành Date và từ chối ngày không hợp lệ bằng 400. Bộ lọc là `updatedAt >= since`, gồm cả bản ghi xóa mềm để client biết cần xóa local.

```json
{
  "serverTime": "2026-11-14T09:00:00.000Z",
  "since": "2026-11-14T08:00:00.000Z",
  "changes": {
    "experiments": [],
    "datasets": [],
    "trainingRuns": []
  }
}
```

Khi nhận bản ghi có `deletedAt`, loại nó khỏi dữ liệu hiển thị local; các bản ghi còn lại có thể upsert theo `clientId`. Do điều kiện `>=`, client phải chịu được bản ghi lặp ở biên thời gian. API hiện không có phân trang, thứ tự đảm bảo hay snapshot nhất quán giữa ba collection. `serverTime` được lấy sau truy vấn, không phải cursor giao dịch; đồng bộ cần tránh giả định đây là bảo đảm không bỏ sót khi có ghi đồng thời.

## Thành phần và kiểm tra

Controller khai báo hai route; service điều phối batch/pull, quyền và phiên bản; DTO mô tả request/kết quả; schema định nghĩa log. Module import cả ba module dữ liệu và xuất SyncService.

Từ gốc, `npm run test:e2e` có ca quyền sở hữu, tham chiếu, xung đột, delete run và snapshot. Khi thay đổi code, cần đối chiếu cả ba loại entity và kiểm tra kết quả từng operation, không chỉ HTTP status hoặc `success` cấp batch.
