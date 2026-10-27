# TypeScript — Kiến thức trọng tâm

## 1. Tổng quan

TypeScript mở rộng JavaScript bằng hệ thống kiểu tĩnh. Trình biên dịch kiểm tra kiểu rồi chuyển mã TypeScript thành JavaScript; thông tin kiểu bị xóa ở runtime.

```ts
const message: string = "Hello, TypeScript";
console.log(message);
```

TypeScript kiểm tra lỗi trong quá trình phát triển, nhưng không tự kiểm tra dữ liệu nhận từ API hoặc người dùng ở runtime.

```ts
type User = { id: number; name: string };

// Cần thư viện/schema kiểm tra runtime nếu dữ liệu không đáng tin cậy.
const user = JSON.parse('{"id": 1, "name": "An"}') as User;
```

## 2. Cài đặt, biên dịch và `tsconfig.json`

```bash
npm install --save-dev typescript
npx tsc --init
npx tsc
```

Cấu hình nền tảng nên bật chế độ kiểm tra nghiêm ngặt.

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist"
  },
  "include": ["src"]
}
```

- `target`: phiên bản JavaScript đầu ra.
- `module`: định dạng module.
- `strict`: bật nhóm kiểm tra kiểu nghiêm ngặt.
- `noEmit`: chỉ kiểm tra kiểu, không xuất JavaScript; phù hợp khi bundler xử lý việc build.
- `lib`: khai báo các API có trong môi trường, ví dụ `DOM`, `ES2022`.

## 3. Suy luận kiểu và annotation

TypeScript thường suy luận được kiểu từ giá trị khởi tạo. Chỉ ghi kiểu tường minh khi nó làm rõ ý định hoặc khi TypeScript không thể suy luận đủ chính xác.

```ts
let language = "TypeScript"; // string
let score = 10;              // number

function multiply(a: number, b: number): number {
  return a * b;
}
```

Khai báo bằng `const` có thể được suy luận thành literal trong một số ngữ cảnh.

```ts
const direction = "left"; // "left"
let nextDirection = "left"; // string
```

## 4. Các kiểu cơ bản

```ts
const name: string = "An";
const age: number = 20;
const active: boolean = true;
const large: bigint = 100n;
const uniqueKey: symbol = Symbol("key");
const empty: null = null;
const missing: undefined = undefined;

const tags: string[] = ["typescript", "javascript"];
const scores: Array<number> = [8, 9, 10];
```

`void` thường dùng cho hàm không trả về giá trị hữu ích. `never` biểu diễn trường hợp không thể xảy ra hoặc hàm không kết thúc bình thường.

```ts
function log(message: string): void {
  console.log(message);
}

function fail(message: string): never {
  throw new Error(message);
}
```

## 5. Object, thuộc tính tùy chọn và `readonly`

```ts
type Product = {
  readonly id: number;
  name: string;
  description?: string;
  price: number;
};

const keyboard: Product = {
  id: 1,
  name: "Bàn phím",
  price: 500_000,
};

keyboard.name = "Bàn phím cơ";
// keyboard.id = 2; // Lỗi: id là readonly
```

`readonly` chỉ kiểm tra lúc biên dịch và mặc định là bất biến nông.

```ts
type Config = {
  readonly database: { host: string };
};

const config: Config = { database: { host: "localhost" } };
config.database.host = "127.0.0.1"; // Hợp lệ
```

## 6. Tuple và enum thay thế

Tuple mô tả array có số phần tử và kiểu tại từng vị trí đã biết.

```ts
type Point = readonly [x: number, y: number];
const position: Point = [10, 20];

type ApiResult = [status: number, message: string];
const result: ApiResult = [200, "OK"];
```

Với tập giá trị cố định, union literal thường đơn giản và an toàn hơn `enum`.

```ts
const roles = ["admin", "editor", "viewer"] as const;
type Role = (typeof roles)[number];

const role: Role = "admin";
```

## 7. `interface` và `type`

Cả hai đều mô tả hình dạng dữ liệu. `interface` phù hợp với object có thể mở rộng; `type` linh hoạt hơn cho union, tuple và kiểu được tạo từ kiểu khác.

```ts
interface User {
  id: number;
  name: string;
}

interface Admin extends User {
  permissions: string[];
}

type Identifier = string | number;
type Coordinates = [number, number];
type UserWithRole = User & { role: "admin" | "member" };
```

Interface hỗ trợ declaration merging.

```ts
interface Settings {
  theme: "light" | "dark";
}

interface Settings {
  language: string;
}

const settings: Settings = { theme: "dark", language: "vi" };
```

## 8. Function

Khai báo kiểu cho tham số, giá trị trả về, tham số tùy chọn và rest parameter.

```ts
function formatUser(
  name: string,
  age?: number,
  ...roles: string[]
): string {
  const ageText = age === undefined ? "chưa rõ tuổi" : `${age} tuổi`;
  return `${name} — ${ageText} — ${roles.join(", ")}`;
}
```

Kiểu hàm dùng để mô tả callback.

```ts
type Operation = (a: number, b: number) => number;

function calculate(a: number, b: number, operation: Operation): number {
  return operation(a, b);
}

calculate(2, 3, (x, y) => x + y);
```

Overload dùng khi quan hệ giữa đầu vào và đầu ra không thể diễn đạt rõ bằng union đơn giản.

```ts
function parse(value: string): string[];
function parse(value: number): number[];
function parse(value: string | number): string[] | number[] {
  return typeof value === "string" ? value.split("") : [value];
}

const chars = parse("TS"); // string[]
const numbers = parse(10); // number[]
```

## 9. Union, literal và intersection

```ts
type Id = string | number;
type Status = "idle" | "loading" | "success" | "error";

function printId(id: Id): void {
  console.log(id);
}

let status: Status = "loading";
status = "success";
```

Intersection kết hợp nhiều kiểu thành một kiểu phải thỏa mãn tất cả thành phần.

```ts
type Timestamped = { createdAt: Date };
type Named = { name: string };
type RecordItem = Timestamped & Named;

const item: RecordItem = {
  name: "Báo cáo",
  createdAt: new Date(),
};
```

## 10. Narrowing

Narrowing thu hẹp union type dựa trên kiểm tra runtime.

### `typeof`, `instanceof` và `in`

```ts
function normalize(value: string | number): string {
  if (typeof value === "string") {
    return value.trim();
  }

  return value.toFixed(2);
}

function getMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

type Cat = { meow(): void };
type Dog = { bark(): void };

function speak(animal: Cat | Dog): void {
  if ("meow" in animal) animal.meow();
  else animal.bark();
}
```

### Discriminated union

Dùng một thuộc tính literal chung để TypeScript xác định chính xác từng trường hợp.

```ts
type Result<T> =
  | { status: "success"; data: T }
  | { status: "error"; message: string };

function render(result: Result<string>): string {
  switch (result.status) {
    case "success":
      return result.data;
    case "error":
      return result.message;
  }
}
```

### Exhaustive checking với `never`

```ts
type Shape =
  | { kind: "circle"; radius: number }
  | { kind: "square"; size: number };

function area(shape: Shape): number {
  switch (shape.kind) {
    case "circle":
      return Math.PI * shape.radius ** 2;
    case "square":
      return shape.size ** 2;
    default: {
      const unreachable: never = shape;
      return unreachable;
    }
  }
}
```

## 11. `any`, `unknown` và type assertion

`any` tắt kiểm tra kiểu và có thể làm lỗi lan truyền. Với dữ liệu chưa biết, ưu tiên `unknown` rồi kiểm tra trước khi dùng.

```ts
function stringify(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number") return value.toString();
  return JSON.stringify(value);
}
```

Type assertion chỉ nói với compiler rằng lập trình viên biết kiểu chính xác hơn; nó không chuyển đổi hay kiểm tra dữ liệu ở runtime.

```ts
const input = document.querySelector("#email") as HTMLInputElement | null;

if (input) {
  console.log(input.value);
}
```

Tránh dùng non-null assertion `!` nếu chưa có bảo đảm từ logic chương trình.

```ts
const element = document.querySelector("#app");
if (!element) throw new Error("Không tìm thấy #app");
element.textContent = "Ready";
```

## 12. Generic

Generic giữ mối quan hệ kiểu giữa đầu vào và đầu ra mà không dùng `any`.

```ts
function first<T>(items: T[]): T | undefined {
  return items[0];
}

const firstNumber = first([10, 20]); // number | undefined
const firstName = first(["An", "Bình"]); // string | undefined
```

Generic constraint giới hạn kiểu hợp lệ.

```ts
type HasId = { id: string | number };

function findById<T extends HasId>(items: T[], id: T["id"]): T | undefined {
  return items.find(item => item.id === id);
}
```

Generic có thể dùng với interface và class.

```ts
interface ApiResponse<T> {
  data: T;
  status: number;
}

const response: ApiResponse<{ name: string }> = {
  data: { name: "An" },
  status: 200,
};
```

## 13. `keyof`, `typeof` và indexed access type

`keyof` tạo union từ các key của một kiểu. `typeof` lấy kiểu của giá trị trong ngữ cảnh type. Indexed access lấy kiểu của một thuộc tính.

```ts
const defaultConfig = {
  theme: "dark",
  pageSize: 20,
};

type Config = typeof defaultConfig;
type ConfigKey = keyof Config;        // "theme" | "pageSize"
type ThemeType = Config["theme"];     // string

function getProperty<T, K extends keyof T>(object: T, key: K): T[K] {
  return object[key];
}

const pageSize = getProperty(defaultConfig, "pageSize"); // number
```

Lấy union từ array literal:

```ts
const levels = ["info", "warning", "error"] as const;
type Level = (typeof levels)[number];
```

## 14. Mapped type và conditional type

Mapped type biến đổi từng thuộc tính của kiểu.

```ts
type Nullable<T> = {
  [K in keyof T]: T[K] | null;
};

type User = { id: number; name: string };
type NullableUser = Nullable<User>;
// { id: number | null; name: string | null }
```

Conditional type chọn kiểu theo điều kiện.

```ts
type ElementType<T> = T extends Array<infer Item> ? Item : T;

type A = ElementType<string[]>; // string
type B = ElementType<number>;   // number
```

## 15. Utility types

```ts
interface User {
  id: number;
  name: string;
  email: string;
  active: boolean;
}

type UserUpdate = Partial<User>;
type CompleteUser = Required<UserUpdate>;
type ReadonlyUser = Readonly<User>;
type UserPreview = Pick<User, "id" | "name">;
type UserWithoutEmail = Omit<User, "email">;
type UsersById = Record<number, User>;

type State = "idle" | "loading" | "success" | "error";
type FinishedState = Exclude<State, "idle" | "loading">;
type ActiveState = Extract<State, "loading" | "success">;
```

Utility types cho hàm:

```ts
function createUser(name: string, age: number) {
  return { id: crypto.randomUUID(), name, age };
}

type CreateUserArgs = Parameters<typeof createUser>; // [string, number]
type CreatedUser = ReturnType<typeof createUser>;
```

## 16. Class và access modifier

```ts
interface Identifiable {
  id: number;
}

class Account implements Identifiable {
  static count = 0;

  constructor(
    public readonly id: number,
    public name: string,
    private balance: number,
    protected currency: string = "VND",
  ) {
    Account.count += 1;
  }

  deposit(amount: number): void {
    if (amount <= 0) throw new Error("Số tiền phải lớn hơn 0");
    this.balance += amount;
  }

  getBalance(): number {
    return this.balance;
  }
}

const account = new Account(1, "An", 100_000);
account.deposit(50_000);
```

- `public`: truy cập ở mọi nơi; là mặc định.
- `private`: chỉ truy cập trong class khai báo.
- `protected`: truy cập trong class và class con.
- Các modifier của TypeScript chủ yếu được kiểm tra khi biên dịch. Dùng trường `#private` của JavaScript nếu cần tính riêng tư ở runtime.

## 17. Module và import kiểu

```ts
// user.ts
export interface User {
  id: number;
  name: string;
}

export function formatUser(user: User): string {
  return `${user.id}: ${user.name}`;
}

// app.ts
import { formatUser } from "./user.js";
import type { User } from "./user.js";

const user: User = { id: 1, name: "An" };
console.log(formatUser(user));
```

`import type` bảo đảm import chỉ dùng cho hệ thống kiểu và bị xóa khỏi JavaScript đầu ra.

## 18. Declaration file và thư viện JavaScript

File `.d.ts` chỉ chứa khai báo kiểu, không chứa phần triển khai runtime.

```ts
// legacy-library.d.ts
declare module "legacy-library" {
  export function format(value: string): string;
}
```

Các package phổ biến thường tích hợp sẵn kiểu hoặc cung cấp qua `@types`.

```bash
npm install some-library
npm install --save-dev @types/some-library
```

Chỉ cài `@types/...` khi package chưa có type declaration riêng.

## 19. `satisfies` và `as const`

`satisfies` kiểm tra giá trị có phù hợp với kiểu nhưng vẫn giữ kiểu cụ thể được suy luận.

```ts
type RouteName = "home" | "profile";
type Route = { path: string; secure: boolean };

const routes = {
  home: { path: "/", secure: false },
  profile: { path: "/profile", secure: true },
} satisfies Record<RouteName, Route>;

routes.profile.secure; // boolean literal được suy luận phù hợp
```

`as const` làm literal hẹp nhất có thể và đánh dấu thuộc tính/array là readonly.

```ts
const action = {
  type: "user/loaded",
  payload: { id: 1 },
} as const;

// action.type có kiểu "user/loaded"
```

## 20. Nguyên tắc sử dụng

```ts
// Tách trạng thái bằng discriminated union thay vì nhiều cờ boolean.
type RequestState<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: T }
  | { status: "error"; error: Error };

// Giữ kiểu gần dữ liệu và suy luận từ nguồn duy nhất.
const permissions = ["read", "write", "delete"] as const;
type Permission = (typeof permissions)[number];
```

- Bật `strict` cho dự án mới.
- Tận dụng suy luận kiểu; tránh annotation lặp lại thông tin hiển nhiên.
- Ưu tiên `unknown` thay cho `any` với dữ liệu chưa biết.
- Mô hình hóa trạng thái bằng union literal và discriminated union.
- Dùng generic để giữ quan hệ kiểu, không dùng generic chỉ để làm chữ ký phức tạp hơn.
- Type assertion không thay thế kiểm tra dữ liệu runtime.
- Tránh `!` và `as` nếu có thể chứng minh kiểu bằng control flow.
- Để compiler kiểm tra đầy đủ các nhánh bằng `never`.

## Nguồn tham khảo

- [TypeScript Handbook — TypeScript for JavaScript Programmers](https://www.typescriptlang.org/docs/handbook/typescript-in-5-minutes.html)
- [W3Schools — TypeScript Introduction](https://www.w3schools.com/typescript/typescript_intro.php)
