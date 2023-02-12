export default async function handler(req, res) {
  res
    .status(200)
    .json({ message: "You are not authorized to access this page" });
}
