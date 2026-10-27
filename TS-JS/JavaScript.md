# JavaScript — Kiến thức trọng tâm

## 1. Tổng quan

JavaScript là ngôn ngữ lập trình động, hướng prototype và hỗ trợ nhiều phong cách lập trình. JavaScript chạy trên trình duyệt, Node.js và nhiều môi trường khác.

```js
console.log("Hello, JavaScript!");
```

- JavaScript phân biệt chữ hoa và chữ thường.
- Mỗi câu lệnh nên kết thúc bằng dấu `;` để tránh các trường hợp chèn dấu chấm phẩy tự động ngoài ý muốn.
- Chế độ nghiêm ngặt giúp phát hiện một số lỗi phổ biến.

```js
"use strict";

const language = "JavaScript";
console.log(language);
```

## 2. Biến và phạm vi

### `const`, `let`, `var`

Ưu tiên `const`; dùng `let` khi cần gán lại. Không nên dùng `var` trong mã hiện đại vì `var` có phạm vi hàm và cơ chế hoisting dễ gây lỗi.

```js
const appName = "Shop"; // Không thể gán lại biến
let total = 0;
total += 100;

if (true) {
  const tax = 10; // Chỉ tồn tại trong block này
  let finalTotal = total + tax;
  console.log(finalTotal);
}
```

`const` ngăn việc gán lại biến, không làm cho object trở thành bất biến.

```js
const user = { name: "An" };
user.name = "Bình"; // Hợp lệ
// user = {};        // TypeError
```

### Hoisting và temporal dead zone

Khai báo hàm được hoist hoàn toàn. `let` và `const` được hoist nhưng không thể truy cập trước dòng khai báo.

```js
sayHello();

function sayHello() {
  console.log("Xin chào");
}

// console.log(score); // ReferenceError
const score = 10;
```

## 3. Kiểu dữ liệu

### Kiểu nguyên thủy

JavaScript có 7 kiểu nguyên thủy: `string`, `number`, `bigint`, `boolean`, `undefined`, `symbol`, `null`.

```js
const title = "JavaScript";       // string
const price = 99.5;               // number
const hugeNumber = 9007199254740993n; // bigint
const isActive = true;            // boolean
let result;                       // undefined
const id = Symbol("id");          // symbol
const selectedItem = null;        // null
```

Object, array và function thuộc nhóm tham chiếu.

```js
const product = { id: 1, name: "Bàn phím" };
const colors = ["red", "blue"];
const greet = () => "Hello";

console.log(typeof product); // "object"
console.log(typeof colors);  // "object"
console.log(typeof greet);   // "function"
console.log(typeof null);    // "object" — đặc điểm lịch sử của JavaScript
```

### Giá trị và tham chiếu

Kiểu nguyên thủy được sao chép theo giá trị. Object được sao chép theo tham chiếu.

```js
let a = 10;
let b = a;
b = 20;
console.log(a); // 10

const first = { count: 1 };
const second = first;
second.count = 2;
console.log(first.count); // 2
```

## 4. Chuyển đổi kiểu, truthy/falsy và so sánh

### Chuyển đổi kiểu tường minh

```js
Number("42");       // 42
String(42);         // "42"
Boolean(1);         // true
Number("abc");     // NaN
Number.isNaN(Number("abc")); // true
```

Các giá trị falsy gồm: `false`, `0`, `-0`, `0n`, `""`, `null`, `undefined`, `NaN`. Các giá trị còn lại là truthy, kể cả `[]` và `{}`.

```js
if ([]) {
  console.log("Array rỗng vẫn là truthy");
}

const displayName = "" || "Khách";       // "Khách"
const savedName = "" ?? "Khách";         // ""
```

### So sánh

Ưu tiên `===` và `!==` vì không tự chuyển đổi kiểu.

```js
console.log(5 === "5");  // false
console.log(5 == "5");   // true — có ép kiểu
console.log(null == undefined);  // true
console.log(null === undefined); // false
```

## 5. Toán tử quan trọng

```js
const subtotal = 100;
const tax = 10;
const total = subtotal + tax;

const canBuy = total <= 150 && subtotal > 0;
const label = canBuy ? "Có thể mua" : "Vượt ngân sách";

const customer = { profile: { name: "Lan" } };
console.log(customer.profile?.name); // "Lan"
console.log(customer.address?.city); // undefined

const quantity = 0;
console.log(quantity ?? 1); // 0
```

- `?.`: truy cập an toàn khi giá trị bên trái là `null` hoặc `undefined`.
- `??`: dùng giá trị bên phải chỉ khi bên trái là `null` hoặc `undefined`.
- `...`: spread để trải phần tử/thuộc tính; rest để thu phần còn lại.

## 6. Điều kiện và vòng lặp

### Điều kiện

```js
const role = "admin";

if (role === "admin") {
  console.log("Toàn quyền");
} else if (role === "editor") {
  console.log("Được chỉnh sửa");
} else {
  console.log("Chỉ xem");
}

switch (role) {
  case "admin":
    console.log("Quản trị viên");
    break;
  default:
    console.log("Người dùng");
}
```

### Vòng lặp

```js
const users = ["An", "Bình", "Chi"];

for (const user of users) {
  console.log(user); // Duyệt giá trị của iterable
}

const scores = { math: 9, english: 8 };
for (const key in scores) {
  console.log(key, scores[key]); // Duyệt key của object
}

for (let index = 0; index < users.length; index += 1) {
  console.log(index, users[index]);
}
```

Không nên dùng `for...in` để duyệt array.

## 7. Hàm

Hàm là giá trị hạng nhất: có thể gán vào biến, truyền làm đối số và trả về từ hàm khác.

```js
function add(a, b = 0) {
  return a + b;
}

const multiply = function (a, b) {
  return a * b;
};

const square = number => number ** 2;

console.log(add(2, 3));       // 5
console.log(multiply(2, 3));  // 6
console.log(square(4));       // 16
```

### Rest parameters và callback

```js
function sum(...numbers) {
  return numbers.reduce((total, number) => total + number, 0);
}

function calculate(a, b, operation) {
  return operation(a, b);
}

console.log(sum(1, 2, 3));
console.log(calculate(4, 5, (x, y) => x + y));
```

### Closure

Closure cho phép hàm ghi nhớ phạm vi nơi nó được tạo ra.

```js
function createCounter() {
  let count = 0;

  return function () {
    count += 1;
    return count;
  };
}

const counter = createCounter();
console.log(counter()); // 1
console.log(counter()); // 2
```

## 8. Array

Các phương thức thường dùng:

```js
const products = [
  { name: "Chuột", price: 200 },
  { name: "Bàn phím", price: 500 },
  { name: "Màn hình", price: 3000 },
];

const names = products.map(product => product.name);
const affordable = products.filter(product => product.price < 1000);
const keyboard = products.find(product => product.name === "Bàn phím");
const total = products.reduce((sum, product) => sum + product.price, 0);
const hasExpensiveItem = products.some(product => product.price > 2000);
const allInStock = products.every(product => product.price > 0);
```

- `map`: tạo array mới sau khi biến đổi từng phần tử.
- `filter`: tạo array mới gồm các phần tử đạt điều kiện.
- `find`: trả về phần tử đầu tiên đạt điều kiện.
- `reduce`: gộp array thành một giá trị.
- `some` / `every`: kiểm tra một / tất cả phần tử.

Các phương thức như `push`, `pop`, `splice`, `sort`, `reverse` thay đổi array gốc.

```js
const original = [3, 1, 2];
const sorted = [...original].sort((a, b) => a - b);

console.log(original); // [3, 1, 2]
console.log(sorted);   // [1, 2, 3]
```

## 9. Object, destructuring và spread

```js
const user = {
  id: 1,
  name: "An",
  address: { city: "Hà Nội" },
  greet() {
    return `Xin chào ${this.name}`;
  },
};

const { name, address: { city } } = user;
const updatedUser = { ...user, name: "Bình" };

console.log(Object.keys(user));
console.log(Object.values(user));
console.log(Object.entries(user));
```

Spread chỉ sao chép nông. Object lồng nhau vẫn dùng chung tham chiếu.

```js
const copy = { ...user };
copy.address.city = "Đà Nẵng";
console.log(user.address.city); // "Đà Nẵng"

const plainUser = { id: 1, address: { city: "Hà Nội" } };
const deepCopy = structuredClone(plainUser);

// structuredClone(user) sẽ lỗi vì user chứa method greet.
```

## 10. `this`

Giá trị `this` phụ thuộc vào cách hàm được gọi. Arrow function không tạo `this` riêng mà nhận `this` từ phạm vi bên ngoài.

```js
const account = {
  name: "An",
  showName() {
    console.log(this.name);
  },
};

account.showName(); // "An"

const detached = account.showName;
// detached(); // this không còn là account

const bound = account.showName.bind(account);
bound(); // "An"
```

```js
function Timer() {
  this.seconds = 0;

  setInterval(() => {
    this.seconds += 1; // Arrow function giữ this của Timer
  }, 1000);
}
```

## 11. Prototype và class

JavaScript kế thừa qua prototype. `class` là cú pháp rõ ràng hơn được xây dựng trên cơ chế prototype.

```js
class User {
  #password;

  constructor(name, password) {
    this.name = name;
    this.#password = password;
  }

  greet() {
    return `Xin chào ${this.name}`;
  }
}

class Admin extends User {
  constructor(name, password, permissions) {
    super(name, password);
    this.permissions = permissions;
  }
}

const admin = new Admin("Lan", "secret", ["read", "write"]);
console.log(admin.greet());
```

## 12. Xử lý lỗi

```js
function parseUser(json) {
  try {
    const user = JSON.parse(json);

    if (!user.name) {
      throw new Error("Thiếu tên người dùng");
    }

    return user;
  } catch (error) {
    console.error(error.message);
    return null;
  } finally {
    console.log("Hoàn tất xử lý");
  }
}
```

Chỉ bắt lỗi khi có thể xử lý, bổ sung ngữ cảnh hoặc dọn dẹp tài nguyên; không nên bỏ qua lỗi âm thầm.

## 13. Promise, `async`/`await` và event loop

JavaScript thực thi mã đồng bộ trên call stack. Các tác vụ bất đồng bộ được môi trường xử lý và callback được đưa vào hàng đợi. Promise callback chạy trong microtask queue, trước callback của timer ở vòng lặp sự kiện kế tiếp.

```js
console.log("A");

setTimeout(() => console.log("B"), 0);
Promise.resolve().then(() => console.log("C"));

console.log("D");
// A, D, C, B
```

```js
function delay(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

async function run() {
  try {
    await delay(500);
    console.log("Hoàn tất");
  } catch (error) {
    console.error(error);
  }
}

run();
```

Chạy song song các tác vụ không phụ thuộc nhau bằng `Promise.all`.

```js
const [user, orders] = await Promise.all([
  fetch("/api/user").then(response => response.json()),
  fetch("/api/orders").then(response => response.json()),
]);
```

## 14. Module ES

Mỗi file module có phạm vi riêng. Dùng `export` để công khai giá trị và `import` để sử dụng.

```js
// math.js
export const PI = 3.14159;
export function add(a, b) {
  return a + b;
}

// app.js
import { PI, add } from "./math.js";
console.log(add(PI, 2));
```

Default export chỉ có một giá trị trong mỗi module.

```js
// logger.js
export default function log(message) {
  console.log(message);
}

// app.js
import log from "./logger.js";
```

## 15. DOM và sự kiện

DOM và Fetch là Web API của trình duyệt, không phải phần lõi của ngôn ngữ JavaScript.

```html
<button id="save-button">Lưu</button>
<p id="status"></p>

<script type="module">
  const button = document.querySelector("#save-button");
  const status = document.querySelector("#status");

  button.addEventListener("click", () => {
    status.textContent = "Đã lưu";
    status.classList.add("success");
  });
</script>
```

Event bubbling cho phép xử lý sự kiện bằng delegation.

```js
document.querySelector("#user-list").addEventListener("click", event => {
  const button = event.target.closest("button[data-user-id]");
  if (!button) return;

  console.log(button.dataset.userId);
});
```

## 16. Fetch và JSON

`fetch` chỉ reject khi có lỗi mạng hoặc request bị hủy; HTTP 4xx/5xx vẫn cần kiểm tra `response.ok`.

```js
async function getUser(id) {
  const response = await fetch(`/api/users/${id}`);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.json();
}

const json = JSON.stringify({ name: "An", age: 20 });
const object = JSON.parse(json);
```

## 17. `Map` và `Set`

`Map` lưu cặp key–value với key thuộc mọi kiểu. `Set` lưu các giá trị duy nhất.

```js
const visits = new Map();
visits.set("home", 10);
visits.set("products", 5);
console.log(visits.get("home"));

const tags = new Set(["js", "web", "js"]);
console.log([...tags]); // ["js", "web"]
```

## 18. Thực hành quan trọng

```js
// Kiểm tra đầu vào sớm
function calculateDiscount(price, percent) {
  if (!Number.isFinite(price) || price < 0) {
    throw new TypeError("price phải là số không âm");
  }

  return price * (1 - percent / 100);
}

// Không thay đổi dữ liệu đầu vào khi không cần thiết
function addItem(items, item) {
  return [...items, item];
}
```

- Dùng `const` và `let`, tránh `var`.
- Ưu tiên `===` và `!==`.
- Đặt tên thể hiện ý nghĩa; mỗi hàm nên làm một nhiệm vụ rõ ràng.
- Tránh biến toàn cục và thay đổi dữ liệu ngoài ý muốn.
- Xử lý đầy đủ trạng thái loading, thành công và lỗi với mã bất đồng bộ.
- Không dùng `eval()` với dữ liệu không tin cậy.

## Nguồn tham khảo

- [MDN — JavaScript](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
- [W3Schools — JavaScript Tutorial](https://www.w3schools.com/js/)
