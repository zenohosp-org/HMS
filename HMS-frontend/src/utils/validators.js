const validateEmail = (email) => {
  if (!email) return "Email is required";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Invalid email address";
};
const validatePassword = (password) => {
  if (!password) return "Password is required";
  if (password.length < 6) return "Password must be at least 6 characters";
};
const validateRequired = (value, label = "This field") => {
  if (!value || !value.trim()) return `${label} is required`;
};
const validatePhone = (phone) => {
  if (!phone) return void 0;
  if (!/^\+?[\d\s\-()]{7,15}$/.test(phone)) return "Invalid phone number";
};
const TZ = 'Asia/Kolkata'
const formatDate = (iso) => {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString("en-IN", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric" });
};
const formatDateTime = (iso) => {
  if (!iso) return '—'
  return new Date(iso).toLocaleString("en-IN", {
    timeZone: TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
};
const calcAge = (dob) => {
  const birth = new Date(dob);
  const now = /* @__PURE__ */ new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || m === 0 && now.getDate() < birth.getDate()) age--;
  return age;
};
const generateInvoiceNumber = () => {
  const now = /* @__PURE__ */ new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
  const rand = Math.floor(Math.random() * 9e3) + 1e3;
  return `INV-${dateStr}-${rand}`;
};
export {
  calcAge,
  formatDate,
  formatDateTime,
  generateInvoiceNumber,
  validateEmail,
  validatePassword,
  validatePhone,
  validateRequired
};
