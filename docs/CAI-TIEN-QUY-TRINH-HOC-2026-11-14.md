# Cải thiện quy trình học và biểu diễn hồi quy 3D

Ngày: 14/11/2026. Phạm vi: frontend Angular hiện có và trường lưu kết quả mở rộng ở backend. Không tự commit/push trong đợt này.

Tinh giản cho người mới: phần “Thử nghiệm & so sánh cấu hình” tập trung chọn cấu hình, chạy, đánh giá và so sánh; giải thích phép tính nằm ở trang học từng bước. Lần đầu không yêu cầu giả thuyết, từ lần tiếp theo có câu hỏi gợi ý theo thuật toán hoặc tự viết/bỏ qua. Câu hỏi là ghi chú định hướng, không tự đổi siêu tham số. Bảng đánh giá đối chiếu validation MSE, thời gian tính và số vòng với mốc cùng dữ liệu. Nhật ký vẫn lưu trường `hypothesis` để tương thích, giao diện gọi là “Câu hỏi / mục tiêu”; API không đổi. Kiểm chứng mới: 203/203 unit tests và production build đạt; Playwright luồng thực nghiệm và học A–F đạt.

Trang học bổ sung đường hồi quy xanh sáng theo x₁ qua lát cắt của mẫu đang chọn: giữ các biến khác cố định, lấy dự đoán từ mô hình thật. Đường và bề mặt chuyển dần sang hệ số đề xuất ở E; F xác nhận cập nhật. Đường không phải đường nối mọi điểm dữ liệu. Kiểm chứng bổ sung: frontend 201/201 unit tests và production build đạt; Playwright `lesson-trace` đạt, đã xem ảnh trước/sau chuyển động. Kết quả kiểm thử tại các mốc bên dưới là lịch sử.

## 1. Cách sử dụng mới

1. Chọn thuật toán, xem dữ liệu đầu vào X và mục tiêu y.
2. Dữ liệu mới chia train/validation/test. Phần phát triển mặc định 80%; 80% của phần đó dùng train, 20% dùng validation. Ví dụ 500 mẫu cho 320 train, 80 validation, 100 test.
3. Ghi giả thuyết rồi chạy cấu hình ban đầu. Mỗi vòng cập nhật từ toàn bộ train; worker chỉ theo dõi validation trong quá trình học.
4. Đọc sai số, thời gian, số vòng và lý do dừng; ghi nhận nhận xét và chọn mốc so sánh.
5. Giữ nguyên dữ liệu và các tập đã chia, đổi một siêu tham số rồi chạy lại.
6. Khi chọn cấu hình cuối, bấm đánh giá test. Nếu tiếp tục chỉnh sau khi xem test, giao diện cảnh báo test không còn độc lập.
7. Đăng nhập để lưu kết quả đầy đủ xuống IndexedDB sau đánh giá test; đồng bộ vẫn chỉ thực hiện khi bấm nút. Guest dùng được nhật ký trong bộ nhớ và xuất JSON.

Nhật ký tối đa 30 lần thử, mất khi tải lại/đổi tài khoản; có nút xuất JSON. Bản kết quả đã lưu vẫn theo cơ chế IndexedDB và sync thủ công. Tạm dừng trước khi lưu; không âm thầm mở test trong thao tác lưu.

## 2. Phép học và phép đo

- CSV chia tập trước khi tính trung bình điền thiếu và thống kê chuẩn hóa; chỉ train tham gia fit. Validation/test dùng cùng thống kê train.
- Linear/Polynomial dùng gradient MSE; Ridge thêm phạt L2; Lasso dùng ISTA. Trọng số bằng 0 khi chạy mới.
- computeMs đo gradient/cập nhật và tính sai số trong worker, có thêm truy vết ở chế độ học. setupMs đo khởi tạo, biến đổi đặc trưng và đánh giá ban đầu.
- Không cộng thời gian chờ hoạt ảnh, dừng đọc, truyền tin và vẽ 3D. Độ phân giải đồng hồ có thể làm bước nhanh hiển thị 0,00 ms.
- Một lần đo trên thiết bị/trình duyệt hiện tại không phải benchmark. Không kết luận tốc độ khi khác dữ liệu hoặc chế độ; lần đã đổi chế độ được đánh dấu mixed.
- Dừng khi đủ vòng hoặc chênh lệch hàm mục tiêu dưới tolerance; hội tụ không chứng minh tổng quát hóa tốt.
- Gợi ý dùng validation. Hai loss gần nhau không tự động được kết luận là mô hình tốt.

## 3. Biểu diễn từng pha

Desktop giữ 3D bên trái và giải thích bên phải; mobile xếp dọc. Mặc định dừng từng pha để bấm Tiếp tục. Nút Tự trình diễn là lựa chọn riêng, chỉ đi một vòng A–F.

**Tinh chỉnh bố cục theo phản hồi:** khối Học qua thực nghiệm mặc định thu thành thanh tiến trình gọn. Bấm từng bước mới mở hướng dẫn, vùng nội dung có chiều cao tối đa và cuộn riêng; khi bắt đầu chạy, hướng dẫn tự đóng để ưu tiên mô hình và số liệu. Thanh chỉ số được giữ phía trên khi cuộn. Bề mặt hồi quy ở trang học luôn hiện ngay từ pha A như trang thực nghiệm (một đặc trưng hiện đường, từ hai đặc trưng hiện mặt); E xem trước đề xuất, F mới cập nhật thật.

File chính của lượt tinh chỉnh: FE features/experiment-workflow/ (thanh hướng dẫn), app.css (chỉ số khi cuộn), core/engine/model-view.ts (hiện mặt xuyên suốt), viewport3d.ts (chú thích pha A), angular.json (cách ly môi trường unit test). Kiểm chứng: production build và 200/200 unit test đạt; browser compact-learning và experiment-workflow đạt. Ảnh bổ sung: compact-lab-desktop.png, compact-lab-mobile.png, lesson-surface-A.png, lesson-surface-E.png trong output/playwright của FE.

| Pha | Biểu diễn | Mô hình thật |
| --- | --- | --- |
| A | Đánh dấu mẫu đang theo dõi | Chưa đổi |
| B | Điểm dự đoán xuất hiện/chuyển đến vị trí dự đoán | Chưa đổi |
| C | Đoạn sai số từ điểm thật đến dự đoán | Chưa đổi |
| D | Các đoạn sai số trên toàn bộ train | Chưa đổi |
| E | Bề mặt đề xuất chuyển từ hệ số cũ sang mới | Chỉ xem trước |
| F | Trạng thái sau khi worker xác nhận commit | Đúng một cập nhật |

Nội suy chuyển động không tạo vòng học trung gian; điểm dữ liệu thật giữ nguyên tọa độ. Xem lại không gửi commit; cuộn chỉ đọc. Chế độ giảm chuyển động hiện ngay trạng thái thay cho tween.

## 4. Lưu trữ và API

Không thêm endpoint, backend vẫn có 27 route. Thêm learningReport tùy chọn vào schema, DTO và allowlist của experiment, gồm protocol train-validation-test-v1, validation metrics, thời gian, lý do dừng, giả thuyết, nhận xét, mode và trạng thái đã xem test. CSV snapshot thêm validationX/validationY.

Bản synthetic cũ chưa có protocol dùng lại cách chia train/test cũ; bản CSV cũ giữ nguyên các tập đã lưu. Giao diện cảnh báo chưa có validation, không tự đổi cách chia lúc mở lại. Với protocol mới, trainRatio trong cấu hình synthetic là tỷ lệ phần phát triển, được chia tiếp 80% train/20% validation. Backend lưu chỉ số do client gửi, không tính lại để chứng nhận.

CSV xuất kết quả thêm validation_mse, compute_ms, setup_ms, stop_reason, hypothesis, conclusion, evaluation_protocol. JSON giữ trường mở rộng. Báo cáo tùy chọn không hợp lệ được bỏ qua khi đọc để tránh lỗi giao diện.

## 5. File thay đổi chính

| Nhóm | Nội dung |
| --- | --- |
| FE core/engine/experiment-workflow.ts, csv.ts | Chia ba tập và so sánh có kiểm soát |
| FE training-session.ts, regression.worker.ts | Đo thời gian, lý do dừng |
| FE state/lab-store.ts | Validation, nhật ký, mốc so sánh, test theo lựa chọn |
| FE features/experiment-workflow/ | Thanh quy trình, giả thuyết, nhận xét, xuất nhật ký |
| FE learning-walkthrough/, learning-route/, viewport3d/ | Dừng từng pha, đồng bộ minh họa với kết quả thật |
| FE results-panel/, algorithm-notes/ | Dùng validation để theo dõi và nhận xét |
| FE models, experiments-store, experiments-panel | Lưu/xuất báo cáo mở rộng, điều kiện lưu cuối |
| Backend experiments và common/ownership.ts | Nhận/lưu learningReport |
| Unit, API E2E và browser tests | Chia tập, leakage, timing, lưu/sync và A–F |

## 6. Kiểm chứng và giới hạn

Kết quả cuối ghi trong [ghi chú kiểm chứng API](KIEM-CHUNG-BAO-CAO-API.md). Browser dùng Worker thật; kiểm tra lưu/sync dùng API fixture. Backend E2E dùng MongoDB tạm và kiểm tra round-trip learningReport. Không dùng kết quả fixture để khẳng định DB thật/HTTPS đã đạt.

Frontend: 197/197 unit test; backend: 38/38 unit và 21/21 API E2E; build cả hai đạt. Sáu nhóm browser đã đạt: experiment-workflow, lab, page-modes, learning-offline, smooth-learning, model-integrity. Đây không phải kết quả chạy lại mọi browser suite trong repository.

Ảnh kiểm tra tại FE/FE-hoiquy3d/output/playwright/: experiment-workflow-desktop.png, manual-learning-desktop.png, manual-learning-mobile.png.

Nginx/HTTPS không được sửa hoặc triển khai trong đợt này; giới hạn chuyển tiếp experiments/bulk đã ghi trong báo cáo API vẫn cần xử lý trước nghiệm thu Docker.
