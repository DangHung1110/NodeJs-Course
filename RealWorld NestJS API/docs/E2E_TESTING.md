# PR-06 — E2E và C2

## Khởi động

Node.js 22, Docker Compose v2. Chạy trong `RealWorld NestJS API`:

```powershell
docker compose -f compose.test.yml up -d --wait
Copy-Item .env.test.example .env.test.local
npm ci
npm run build
npm run lint
npm run typecheck
npm run test
npm run test:e2e:coverage
npm run test:e2e -- --randomize --seed=606
npm run test:e2e -- --testNamePattern=CommentsController
```

`.env.test.local` chỉ chứa cấu hình test và bị Git ignore. Không dùng `.env` hay
`.env.local` khi bootstrap test. CI truyền trực tiếp biến môi trường.
Các mật khẩu trong compose/example là fixture cho container tạm, không phải
thông tin đăng nhập thật. MySQL riêng ở cổng 13306, Redis riêng ở 16379;
không dùng các dịch vụ development ở 3306/6379.

## Kiến trúc và vòng đời

- `npm test`: unit, HTTP contract dùng mock và integration MySQL hiện có.
  Integration chỉ chạy khi có `MYSQL_TEST_HOST`; không được tính test skip là pass.
- `npm run test:http`: chỉ HTTP contract cũ.
- `npm run test:e2e`: `AppModule` thật, Supertest, JWT/OTP/Redis/TypeORM thật;
  chỉ `MailService` được thay bằng outbox để bắt OTP, không gọi SMTP bên ngoài.
- `jest.e2e.config.cjs` chạy tuần tự với một worker; không chạy hai tiến trình
  test dùng cùng DB đồng thời. Muốn chạy song song cần DB và user riêng từng tiến trình.
- Kết nối → kiểm tra danh tính DB → chạy migration hiện có (`synchronize=false`)
  → reset → seed trước từng test → HTTP workflow → cleanup sau từng test → đóng app,
  MySQL, Redis và xóa thư mục upload khi kết thúc. Lỗi khởi động cũng gọi teardown.
- `seedBaseline` tạo users có mật khẩu bcrypt, follow, article/tag, favorite, comment.
  Avatar workflow tạo attachment metadata bằng upload HTTP thật.
- Reset dùng transaction `DELETE` theo thứ tự khóa ngoại, không tắt FK, không drop DB;
  các bảng dùng UUID nên không có auto-increment phải reset.
- Redis dùng DB 15 và prefix ngẫu nhiên `e2e:<uuid>:` trên cả RedisService thật và cleanup;
  cleanup chỉ SCAN/DEL prefix đó, không FLUSHDB/FLUSHALL.
- Upload dùng thư mục `realworld-e2e-*` tạo bằng `mkdtemp`, kiểm tra đường dẫn trước khi xóa.

## Bảo vệ dữ liệu

Trước seed/reset/revert phải có `NODE_ENV=test`, tên DB theo mẫu
`^realworld(?:_[a-z0-9]+)?_test$`, `MYSQL_TEST_APPROVED_DATABASE` khớp chính xác,
host loopback, tài khoản riêng cùng tên DB, không dùng root. Guard so sánh options
của DataSource và `SELECT DATABASE(), CURRENT_USER()` của kết nối thật.
Compose/CI cấp user quyền trên duy nhất DB test và dùng MySQL container riêng.
Không cấp tài khoản test quyền trên DB development. Guard không thể thay thế
việc giới hạn quyền DB hoặc môi trường container tách biệt.

Các test guard dùng DataSource giả, không reset DB không phải test để thử guard.
Suite kiểm tra count=0, không còn Redis key theo prefix và thư mục upload rỗng sau
từng case. Không coi test tự bắt lỗi rồi tự gọi reset là bằng chứng teardown khi
một kịch bản thất bại thật.

Không gọi migration CLI production với `.env` khi test. E2E gọi `runMigrations()`
trên DataSource đã xác thực. Case migration chạy down/up migration comments cuối
và giải phóng QueryRunner. Dừng container test sau khi dùng:

```powershell
docker compose -f compose.test.yml down -v
```

## C2 và CI

C2 theo `ARCHITECTURE.md` là branch/decision coverage. Chọn `CommentsController`:
quyết định `request.user?.sub` được chạy bằng GET anonymous và GET có JWT thật.
Các phương thức create/list/delete đều được gọi; luồng 401/403/404/422 kiểm tra
guard, validation và service thật, không phải bằng chứng coverage toàn bộ service.

Jest instrument đúng `src/comments/comments.controller.ts`; threshold từng file
100% statements/branches/functions/lines, không bỏ qua nhánh khó. Báo cáo nằm ở
`coverage/e2e/lcov-report/index.html`, `coverage/e2e/lcov.info`,
`coverage/e2e/coverage-summary.json` và text console.
Kết quả sau review mentor: 7 kịch bản E2E (bỏ case cleanup trùng lặp);
CommentsController đạt 100% statements,
branches (4/4), functions và lines, không còn nhánh chưa chạy. ts-jest dùng TypeScript
compiler đầy đủ (không isolated transpilation) và target ES2019 để Istanbul
ghi nhận quyết định optional chaining thay vì báo 100% với 0 branch.
Không thêm ignore coverage hay loại nhánh source.

Workflow Tests chạy Ubuntu/Node22, MySQL8.4 với user riêng, Redis7 có healthcheck,
build/lint/typecheck/test, E2E coverage, chạy lại suite với thứ tự ngẫu nhiên
(seed 606) và chạy comments độc lập;
upload artifact `pr06-e2e-coverage`. Workflow Sunlint giữ nguyên cả heuristic và
ESLint engines; link run và screenshot thật được ghi trong PR.
