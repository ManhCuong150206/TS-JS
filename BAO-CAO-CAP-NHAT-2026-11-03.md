# Báo cáo cập nhật xác thực, lưu mô hình và đồng bộ — 03/11/2026

## 1. Phạm vi so sánh

So với bản đã push ngay trước đợt này: backend `0c54733`, frontend `75bb8b2`. Đây là hai Git repository riêng: `D:/JS,TS` và `D:/JS,TS/FE/FE-hoiquy3d`. Bảng dưới liệt kê từng file sửa/thêm của đợt này; không phải lịch sử toàn bộ thay đổi từ ngày đầu dự án.

## 2. Những thay đổi người dùng nhìn thấy

| Trước đợt sửa | Sau đợt sửa | Ví dụ dễ hiểu |
| --- | --- | --- |
| Form đăng nhập chủ yếu là demo | Xác thực bằng API và phiên cookie thật | Sai mật khẩu sẽ ở lại trang đăng nhập và hiện lỗi |
| Lưu chưa giữ đầy đủ mô hình/CSV xuyên suốt | Lưu w, b, iteration, metric, tham số và train/test CSV đã xử lý | Học đến iteration 12, lưu, mở lại vẫn khôi phục iteration 12 |
| Đồng bộ chủ yếu gửi lên | Gửi thay đổi và kéo danh sách server, có phân trang | Xóa bản cache cục bộ rồi đăng nhập lại vẫn kéo được bản server |
| Xóa cục bộ có thể không tới server | Giữ dấu xóa để gửi sau khi có mạng | Xóa lúc offline, online lại bản ghi bị xóa mềm trong MongoDB |
| Có nguy cơ tài khoản dùng chung dữ liệu/ID tự khai | Lọc theo danh tính phiên server ở API và vùng local | Tài khoản B không đọc/sửa/xóa experiment của A |
| Chưa phân biệt bản cũ trên thiết bị khác | Kiểm tra phiên bản; có giao diện chọn cách giải quyết | Hai máy sửa cùng bản: máy có phiên bản cũ nhận 409, không tự ghi đè |
| Ridge/Lasso xét dừng bằng MSE | Xét dừng theo MSE + phần phạt của thuật toán | Phần phạt vẫn thay đổi thì không kết luận hội tụ chỉ từ MSE |
| PWA thiếu shell CSR trong cache | Cache cả index.csr.html và Worker | Tải web đủ một lần online, sau đó reload offline vẫn học được |
| Chọn Guest lại offline có thể hiện bản lưu trùng | Chỉ chuyển dữ liệu khi ID thực sự thay đổi | Reload rồi bấm Guest giữ đúng một bản cho mỗi experiment |

## 3. Backend — đường dẫn tính từ D:/JS,TS

| File | Trạng thái | Đã sửa hoặc bổ sung | Tác dụng dễ hiểu |
| --- | --- | --- | --- |
| `.env.example` | Sửa | Bổ sung NODE_ENV và CORS_ORIGINS mẫu. | Chọn chế độ chạy và giới hạn địa chỉ FE được gọi API; không đưa mật khẩu thật lên Git. |
| `README.md` | Sửa | Hướng dẫn auth, đồng bộ, giới hạn, proxy và database test. | Thành viên mới biết chạy BE/FE và phân biệt test thật với mô phỏng. |
| `src/app.module.ts` | Sửa | Nạp AuthModule; đọc MONGODB_DB_NAME. | Bật xác thực và cho test chọn database riêng, không ghi vào dữ liệu ứng dụng. |
| `src/main.ts` | Sửa | JSON tối đa 10 MiB; CORS theo danh sách origin. | Nhận được snapshot CSV lớn hơn giới hạn JSON mặc định và không mở API có cookie cho mọi website. |
| `src/auth/auth.module.ts` | Mới | Khai báo collection người dùng, phiên đăng nhập và middleware. | MongoDB lưu người dùng và phiên; phiên có ngày hết hạn và TTL để dọn dần. |
| `src/auth/auth.controller.ts` | Mới | Thêm register/login/guest/session/logout dưới /api/v1/auth. | FE có API đăng ký, đăng nhập, tạo Guest và đăng xuất thật. |
| `src/auth/auth.service.ts` | Mới | Kiểm tra đầu vào; scrypt + salt cho mật khẩu; session ngẫu nhiên, chỉ lưu hash; cookie HttpOnly; giới hạn thử và kiểm tra nguồn request. | Mật khẩu không được lưu nguyên văn. ID người dùng tự gõ không còn đủ để truy cập API. |
| `src/common/auth.guard.ts` | Sửa | Lấy danh tính từ cookie đã được server xác minh; kiểm tra X-Expected-User. | Chặn giả mạo x-user-id/Bearer ID và chặn đồng bộ nhầm khi phiên đã đổi tài khoản. |
| `src/experiments/schemas/experiment.schema.ts` | Sửa | Thêm trọng số w, bias b, iteration, tham số, metric, CSV đã xử lý và lastMutationId; sửa mặc định algorithm.config. | MongoDB lưu đủ trạng thái để mở lại mô hình; Linear không bị mất cấu hình khi lưu/xóa. |
| `src/experiments/saved-snapshot.ts` | Mới | Chỉ nhận các trường được phép; kiểm tra số hữu hạn, kích thước, metric, ma trận CSV, chỉ số và provenance. | Từ chối bản lưu sai cấu trúc; giới hạn mỗi snapshot 8 MiB. |
| `src/experiments/experiments.controller.ts` | Sửa | Truyền chủ phiên tới service; thêm includeDeleted khi lấy danh sách. | Đọc đúng dữ liệu của mình và nhận cả thông tin đã xóa để đồng bộ. |
| `src/experiments/experiments.service.ts` | Sửa | Lưu snapshot đầy đủ; xác nhận từng mutation; phiên bản cập nhật có điều kiện; xóa mềm; lọc owner; PATCH chỉ nhận trường cho phép. | Gửi lại request không tạo bản sao; thiết bị dùng bản cũ nhận 409 thay vì âm thầm ghi đè. |
| `src/experiments/experiments.controller.spec.ts` | Sửa | Cập nhật kỳ vọng controller truyền userId và tùy chọn đọc. | Phát hiện controller gọi service sai phạm vi người dùng. |
| `src/experiments/experiments.service.spec.ts` | Sửa | Cập nhật mock lưu theo phiên bản và phản hồi từng item. | Kiểm tra service xử lý và xác nhận lô lưu đúng giao thức mới. |
| `src/datasets/datasets.controller.ts` | Sửa | Truyền chủ phiên khi đọc/tải/xóa; multipart giới hạn một file 10 MiB. | Người dùng chỉ thao tác dataset của mình, hạn chế upload quá lớn. |
| `src/datasets/datasets.service.ts` | Sửa | Lọc owner; metadata không tự gán storage; kiểm tra khóa file và đường dẫn nằm trong thư mục lưu. | Chặn dùng metadata để trỏ đến file khác trên server, ví dụ ../../.env. |
| `src/training-runs/training-runs.controller.ts` | Sửa | Truyền danh tính tới thao tác đọc training run. | Kết quả huấn luyện không bị đọc chéo người dùng. |
| `src/training-runs/training-runs.service.ts` | Sửa | Kiểm tra chủ experiment khi tạo run, lọc owner và giới hạn phân trang. | Không gắn run vào thí nghiệm của tài khoản khác. |
| `src/sync/sync.service.ts` | Sửa | Bổ sung owner vào truy vấn/idempotency; giữ owner/clientId khi cập nhật; không nhận storage từ dataset payload; kiểm tra since. | Gia cố API sync cũ. FE mới chủ yếu dùng experiments/bulk và GET danh sách, không dùng chung hai đường để ghi một thao tác. |
| `test/app.e2e-spec.ts` | Sửa | 12 ca API thật: auth, MongoDB round trip, phiên bản, quyền sở hữu, CSRF, file, xóa, hết hạn và đăng xuất. | Chạy với database regression_test_<random>, kiểm tra tên trước khi tự dọn. |
| `test/run-browser-backend.mjs` | Mới | Khởi động API cổng 3000 với database browser test ngẫu nhiên; cho phép origin thử 4300/4400. | Browser kiểm tra FE → API → MongoDB thật mà không dùng database ứng dụng. |
| `test/cleanup-browser-backend.mjs` | Mới | Đọc tên database test và chỉ dọn khi khớp mẫu an toàn. | Dọn dữ liệu test sau khi dừng helper; không phải lệnh xóa database dự án. |
| `BAO-CAO-CAP-NHAT-2026-11-03.md` | Mới | Bảng thay đổi, giải thích thuật ngữ, kết quả và hướng dẫn kiểm tra của cả hai repo. | Tài liệu tổng hợp để nhóm và giảng viên theo dõi đợt cập nhật này. |

## 4. Frontend — đường dẫn tính từ FE/FE-hoiquy3d

| File | Trạng thái | Đã sửa hoặc bổ sung | Tác dụng dễ hiểu |
| --- | --- | --- | --- |
| `README.md` | Sửa | Hướng dẫn dev proxy, chạy production SSR, auth và kiểm thử thật. | Chạy FE đúng backend và tìm báo cáo thay đổi chung. |
| `angular.json` | Sửa | Gắn proxy.conf.json vào ng serve. | FE gọi /api cùng địa chỉ trình duyệt rồi được chuyển sang NestJS. |
| `proxy.conf.json` | Mới | Chuyển /api/** tới 127.0.0.1:3000 khi phát triển. | Tránh nhầm API thành trang HTML và hỗ trợ cookie cùng origin. |
| `ngsw-config.json` | Sửa | Thêm /index.csr.html vào app-shell prefetch. | Angular production dùng tệp này để mở lại trang offline; chỉ cache index.html là chưa đủ. |
| `src/server.ts` | Sửa | Proxy API ở production SSR; timeout 15 giây; lỗi trả JSON 502; SSR_ALLOWED_HOSTS. | Cookie/API đi tới BE thật; localhost được chấp nhận và hostname triển khai phải cấu hình rõ. |
| `src/app/state/auth-session.ts` | Mới | Quản lý phiên thật, Guest offline, đổi danh tính giữa tab và thu hồi phiên; chỉ chuyển dữ liệu khi đổi scope phù hợp. | Giữ dữ liệu từng tài khoản riêng. Bấm lại Guest cùng ID không chuyển dữ liệu vào chính scope đó, tránh hiện trùng. |
| `src/app/state/auth-session.spec.ts` | Mới | Hai ca kiểm tra Guest cùng ID và Guest offline chuyển sang ID server. | Ngăn lỗi nhân đôi bản lưu sau reload offline và xác minh điều kiện chuyển dữ liệu. |
| `src/app/state/experiments-store.ts` | Sửa | IndexedDB theo danh tính; lưu đầy đủ snapshot; chia lô; xác nhận từng item; kéo phân trang; tombstone; xử lý 409; chờ đúng scope; hàng đợi sync. | Lưu khi mất mạng, gửi khi có mạng; không báo đã đồng bộ khi server chưa xác nhận. |
| `src/app/state/experiments-store.spec.ts` | Mới | Test ack, xóa offline, kéo server, tách tài khoản, CSV, chuyển Guest và lưu trong lúc đang kéo. | Kiểm tra các lỗi đồng bộ khó thấy bằng thao tác thông thường. |
| `src/app/state/lab-store.ts` | Sửa | Áp dụng CSV split đã lưu và w/b/iteration; gửi initial cho Worker; resetSession. | Mở lại đúng mô hình đã học, không chỉ lấy lại tham số rồi học từ 0; xóa dữ liệu live khi đổi người. |
| `src/app/state/lab-store.spec.ts` | Sửa | Thêm ca khôi phục bản CSV và trạng thái đã học. | Kiểm tra dữ liệu train/test và trọng số được chuyển đúng vào phiên học. |
| `src/app/core/models/experiment.ts` | Sửa | Thêm CsvSnapshot, scopeId, mutationId, serverVersion, deletedAt. | TypeScript mô tả rõ dữ liệu cần lưu, ai sở hữu và cách đồng bộ. |
| `src/app/core/engine/training-session.ts` | Sửa | Nhận initial để tiếp tục mô hình; kiểm tra trọng số; điều kiện dừng dùng MSE + penalty cho Ridge/Lasso. | Không dừng chỉ vì MSE ít đổi khi thuật toán vẫn đang tối ưu phần phạt L1/L2. |
| `src/app/core/engine/training-session.spec.ts` | Sửa | Bổ sung ca mô hình khôi phục và điều kiện dừng có regularization. | Kiểm tra thay đổi liên quan tính toán, không chỉ giao diện. |
| `src/app/app.ts` | Sửa | Kết nối AuthSession; đăng xuất server; dọn CSV/model khỏi live UI khi đổi tài khoản; Guest qua luồng xác thực. | Không để người sau nhìn thấy dữ liệu đang mở của người trước; giữ chuyển cảnh hiện có. |
| `src/app/app.html` | Sửa | Hiện lỗi phiên; liên kết bàn phím Guest gọi cùng luồng Guest thật. | Thông báo đăng xuất thất bại và không có lối tắt bỏ qua việc tạo phiên. |
| `src/app/app.spec.ts` | Sửa | Mock AuthSession và kỳ vọng ứng dụng theo phiên thật. | Unit test không gọi API thật nhưng kiểm tra điều phối ứng dụng đúng. |
| `src/app/features/welcome-panel/entry-form.ts` | Sửa | Gọi login/register; chờ thành công mới chuyển trang; trạng thái gửi/lỗi; xóa mật khẩu khỏi form ngay sau submit hợp lệ. | Form không còn demo chấp nhận mọi email/mật khẩu. |
| `src/app/features/welcome-panel/entry-form.html` | Sửa | Hiện lỗi API và trạng thái nút đang gửi. | Người dùng biết lỗi thuộc máy chủ và tránh gửi lặp. |
| `src/app/features/welcome-panel/entry-form.spec.ts` | Sửa | Kiểm tra lời gọi auth và dọn credential trong form. | Giữ kiểm tra form cũ, bổ sung hành vi xác thực mới. |
| `src/app/features/welcome-panel/welcome-panel.ts` | Sửa | Guest async, chặn bấm lặp, báo lỗi và chỉ chuyển khi tạo phiên được. | Guest có vùng dữ liệu riêng hoặc Guest offline cục bộ. |
| `src/app/features/welcome-panel/welcome-panel.html` | Sửa | Cập nhật thông báo đăng nhập thật, trạng thái Guest và lỗi. | Nội dung giao diện phù hợp hành vi mới. |
| `src/app/features/welcome-panel/welcome-panel.spec.ts` | Sửa | Mock auth/Guest và kiểm tra hoàn tất bất đồng bộ. | Test không coi bấm Guest là chuyển trang tức thì trước khi xử lý xong. |
| `src/app/features/data-panel/data-panel.html` | Sửa | Hiện tên CSV khi dùng CSV, giữ nhãn synthetic khi dùng dữ liệu sinh. | Tránh người dùng hiểu nhầm nguồn dữ liệu. |
| `src/app/features/experiments-panel/experiments-panel.ts` | Sửa | Thông báo lưu/khôi phục đúng, giữ cảnh báo cho CSV cũ chưa có snapshot. | Phân biệt bản mới khôi phục đầy đủ với bản cũ chỉ có cấu hình. |
| `src/app/features/experiments-panel/experiments-panel.html` | Sửa | Thêm nút đồng bộ thủ công, lỗi sync và hai lựa chọn khi xung đột. | Chủ động kéo server; chọn dùng bản máy chủ hoặc giữ local thành bản sao. |
| `e2e/run-ui-redesign.ps1` | Sửa | Nạp fixture API cho UI test và hỗ trợ -FromSuite. | Chạy lại từ nhóm test bị lỗi; tách UI mô phỏng khỏi test MongoDB thật. |
| `e2e/ui-redesign/api-fixture.e2e.js` | Mới | Mô phỏng auth, danh sách và xác nhận từng bản lưu cho UI suite. | Test chuyển cảnh/bố cục ổn định; không dùng kết quả fixture làm bằng chứng MongoDB. |
| `e2e/ui-redesign/entry.e2e.js` | Sửa | Đổi kỳ vọng demo không gọi API thành form gọi auth API. | Kiểm thử theo cơ chế đăng nhập thật. |
| `e2e/ui-redesign/entry-validation.e2e.js` | Sửa | Cập nhật số request và tiêu chí dọn form sau auth. | Giữ kiểm tra lỗi và focus trong form. |
| `e2e/ui-redesign/learning-offline.e2e.js` | Sửa | Mock phản hồi xác nhận từng mutation. | Luồng học/lưu offline dùng đúng giao thức sync mới. |
| `e2e/ui-redesign/model-integrity.e2e.js` | Sửa | Cập nhật ack có ID, mutation và serverVersion. | Kiểm tra mô hình không bị thay bởi thay đổi giao diện/đồng bộ. |
| `e2e/ui-redesign/navigation-layout.e2e.js` | Sửa | Sau logout kiểm tra dữ liệu model live được xóa, thay kỳ vọng demo giữ nguyên. | Bảo vệ riêng tư khi dùng tài khoản thật; quay lại chọn thuật toán vẫn là luồng riêng. |
| `e2e/ui-redesign/persistence-live.e2e.js` | Mới | 13 tiêu chí browser + API + MongoDB thật: CSV, trọng số, mất cache local, conflict, xóa, tách tài khoản, Guest. | Kiểm chứng dữ liệu đi xuyên suốt, không mock API. |
| `e2e/ui-redesign/pwa-persistence.e2e.js` | Mới | 8 tiêu chí production: cache shell/Worker, reload offline, học/lưu/khôi phục iteration và đồng bộ. | Bắt được lỗi thiếu index.csr.html và lỗi Guest tự chuyển dữ liệu vào cùng scope. |
| `docs/CONG-NGHE-VA-HIEU-UNG.md` | Sửa | Cập nhật auth thật, lưu CSV, sync, giới hạn và bằng chứng test mới; sửa tên biến SSR_ALLOWED_HOSTS. | Giữ một tài liệu công nghệ chính, phân biệt kết quả cũ và kết quả đợt này. |

## 5. Các thuật ngữ và công cụ liên quan

| Từ/công cụ | Hiểu đơn giản | Ví dụ trong dự án |
| --- | --- | --- |
| API | Địa chỉ để FE nhờ BE đọc/ghi dữ liệu | POST /api/v1/experiments/bulk gửi các thí nghiệm cần lưu |
| NestJS / Angular | NestJS tổ chức backend; Angular tổ chức giao diện và trạng thái phía trình duyệt | Controller nhận request, service làm việc với MongoDB; Store điều phối UI |
| Mongoose / schema | Thư viện và cấu trúc mô tả dữ liệu MongoDB | w là mảng số, b là một số, ownerId là chủ bản ghi |
| Snapshot | Bản chụp trạng thái tại thời điểm lưu | CSV split + trọng số + iteration + tham số |
| IndexedDB / PWA / Service Worker | IndexedDB lưu dữ liệu trong trình duyệt; PWA dùng Service Worker cache tệp chạy web | Offline đọc thí nghiệm từ IndexedDB và tải mã ứng dụng từ cache |
| CSR / SSR | CSR chạy giao diện ở trình duyệt; SSR tạo HTML ban đầu ở server | Bản build cần index.csr.html để mở giao diện offline |
| Scope / ownerId | Vùng dữ liệu hoặc chủ sở hữu của một danh tính | Bản lưu tài khoản A không xuất hiện trong danh sách của B |
| Cookie HttpOnly / SameSite | Cookie phiên không cho JS đọc trực tiếp; hạn chế gửi theo một số yêu cầu từ website khác | FE gọi API cùng origin, trình duyệt gửi cookie phiên |
| scrypt / salt / hash | Biến đổi mật khẩu thành giá trị kiểm tra; salt riêng cho từng người | MongoDB không lưu mật khẩu đăng ký nguyên văn |
| mutationId / serverVersion / ack | Mã thao tác, số phiên bản trên server, xác nhận đã nhận | Gửi lại cùng mutation không làm tăng phiên bản lần nữa |
| Tombstone | Bản ghi có dấu đã xóa, còn giữ để đồng bộ | deletedAt giúp máy khác biết experiment đã bị xóa |
| Conflict 409 | Server báo dữ liệu gửi lên đã cũ hoặc xung đột | Chọn dùng bản server hoặc tạo bản sao local |
| Proxy / CORS | Proxy chuyển API tới BE; CORS quy định website nào được gọi API qua trình duyệt | /api ở cổng FE chuyển về NestJS cổng 3000 |
| CSRF | Website khác cố mượn cookie người dùng để gửi thao tác | Middleware kiểm tra nguồn yêu cầu ghi; test nguồn lạ nhận 403 |
| Vitest / Playwright | Vitest chạy logic/test API; Playwright thao tác browser thật | Unit test điều kiện dừng; E2E reload offline và kiểm tra mô hình |
| MiB | Đơn vị dung lượng, 1 MiB = 1.048.576 byte | Snapshot tối đa 8 MiB, JSON request tối đa 10 MiB |

## 6. Luồng hoạt động mới

1. Đăng nhập/đăng ký/Guest online → API auth tạo phiên → trình duyệt nhận cookie. Offline có thể vào Guest cục bộ; đăng nhập/đăng ký tài khoản cần mạng.
2. Học mô hình trên FE → bấm Lưu → snapshot vào IndexedDB của đúng danh tính.
3. Có mạng và phiên hợp lệ → FE gửi lô snapshot → BE kiểm tra chủ sở hữu/cấu trúc/phiên bản → MongoDB lưu → trả ack từng item → FE mới đánh dấu “Đã đồng bộ”.
4. FE đọc toàn bộ các trang dữ liệu server, gồm dấu xóa. Pending local không bị server âm thầm ghi đè.
5. Áp dụng bản lưu → khôi phục CSV split hoặc sinh lại synthetic đúng seed → khôi phục w/b/iteration → có thể học tiếp.
6. Logout online thu hồi phiên và xóa dữ liệu live khỏi giao diện. Bản lưu trên MongoDB/IndexedDB không bị xóa. Logout offline báo chưa thể thu hồi phiên, không giả báo thành công.

## 7. Kiểm thử và cách chạy

### Kết quả đã hoàn tất

| Kiểm tra | Kết quả | Giới hạn của kết luận |
| --- | --- | --- |
| Frontend unit | 126/126, 25 file | Có 2 ca mới về Guest; môi trường jsdom không render WebGL thật |
| Backend unit | 12/12, 3 file | Kiểm tra logic/module với mock phù hợp |
| Backend API + MongoDB thật | 12/12 | Database test riêng, tự dọn; không dùng database ứng dụng |
| Build FE và BE | Đạt | Biên dịch thành công; không đồng nghĩa đã triển khai HTTPS |
| UI E2E | 18 nhóm / 185 tiêu chí đạt | 9 nhóm đầu, sửa kỳ vọng logout cho auth thật rồi chạy 9 nhóm còn lại; API fixture mô phỏng |
| Hồi quy sau chỉnh cuối | 5 nhóm / 43 tiêu chí đạt | entry, entry-validation, navigation-layout, learning-offline, mobile-fallback |
| Browser FE → API → MongoDB thật | 13 tiêu chí đạt | Có CSV, trọng số, khôi phục sau mất cache, conflict, xóa offline và tài khoản riêng |
| PWA production | 8/8 tiêu chí đạt | Service Worker/Worker cache đủ → reload offline → học/lưu → reload/khôi phục → online đồng bộ MongoDB qua SSR proxy |

Log/ảnh nằm trong `FE/FE-hoiquy3d/output/playwright` (bị Git ignore): `persistence-unit-final.log`, `persistence-build-final.log`, `backend-build-final.log`, `backend-unit-final.log`, `backend-e2e-final.log`, `persistence-ui-final.log`, `persistence-ui-remaining.log`, `final-*.log`, `persistence-live-final.log`, `pwa-persistence.log`, `pwa-persistence-complete.png`. Test UI đầu có lỗi kỳ vọng logout cũ; không ghi nhận lần đó là toàn bộ pass. Các nhóm còn lại và các nhóm ảnh hưởng đã chạy lại như bảng trên.

- FE: `npm.cmd test -- --watch=false`; `npm.cmd run build`.
- BE: `npm.cmd run build`; `npm.cmd test`; `npm.cmd run test:e2e` (cần MongoDB hoạt động).
- UI regression: chạy dev FE ở 127.0.0.1:4300, sau đó `powershell -NoProfile -ExecutionPolicy Bypass -File e2e/run-ui-redesign.ps1`.
- Browser thật: dừng BE thật cổng 3000 trước khi chạy `node test/run-browser-backend.mjs`; chạy các file persistence-live/pwa-persistence qua Playwright CLI, theo cổng ghi trong từng script. Các file này không thuộc mặc định UI runner vì cần API/MongoDB thật.
- Production PWA: build FE; đặt PORT=4400 rồi chạy `node dist/Hoiquy3d/server/server.mjs`; helper test cho phép origin 4400. Muốn dùng bản build mới phải khởi động lại SSR server.
- Dừng helper rồi `node test/cleanup-browser-backend.mjs`; helper chỉ dọn database test đúng mẫu. Không chạy lệnh xóa database ứng dụng.
- Khi thử offline thủ công: mở production online, đợi Service Worker và app-shell/Worker cache đủ, sau đó tắt mạng rồi reload. Lần đầu chưa có cache không thể mở offline. Dev server không đại diện cho PWA production.

## 8. Giới hạn và việc nhóm cần biết

- Đây là thay đổi cả FE, API và schema; cần lấy đúng cả hai repo để đồng bộ giao thức. Client cũ gửi ID tự khai sẽ không còn được cấp quyền.
- Bản CSV cũ không có csvData không thể tự khôi phục file từ dữ liệu chưa từng lưu. Dữ liệu cũ không có owner hợp lệ cần migration có kiểm soát; không tự chia sẻ cho mọi tài khoản.
- Snapshot CSV tối đa 8 MiB, file upload tối đa 10 MiB. Chưa triển khai upload nhiều GB/chia chunk/stream huấn luyện. CSV snapshot là dữ liệu đã xử lý, không mặc nhiên là bản sao byte-for-byte của file CSV gốc.
- Đăng nhập cần mạng; Guest là phiên tạm. Chưa có xác minh email, quên mật khẩu hoặc 2FA; giới hạn thử đăng nhập hiện nằm trong bộ nhớ từng tiến trình.
- HTTPS cổng 443/chứng chỉ triển khai chưa được kiểm chứng trong đợt này. Khi triển khai đặt NODE_ENV=production, CORS_ORIGINS và SSR_ALLOWED_HOSTS đúng domain; cần HTTPS cho cookie Secure và PWA ngoài localhost.
- Không có số đo FPS mới trong đợt này. Test pass không bảo đảm mọi thiết bị luôn đạt 60 FPS.
- Không đổi palette, hành tinh, chuyển cảnh hay bố cục 3D chính. Có bổ sung thông báo lỗi/nút sync và dọn mô hình live khi đổi danh tính.
- Không commit .env, token, database thật, node_modules, dist, cache browser hoặc ảnh/log test. Thư mục .agent/ có từ trước không thuộc đợt này.
