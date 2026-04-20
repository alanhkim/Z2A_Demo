// ============================================================================
// debugging_troubleshooting.ts
// This file contains intentional bugs for demo purposes.
// ============================================================================
import { Request, Response } from "express";

var inventory: any[] = [
  { id: 1, name: "Laptop", price: 999.99, stock: 10, category: "electronics" },
  { id: 2, name: "Headphones", price: 49.99, stock: 50, category: "electronics" },
  { id: 3, name: "Notebook", price: 4.99, stock: 200, category: "office" },
  { id: 4, name: "Pen", price: undefined, stock: 500, category: "office" },
  { id: 5, name: "Monitor", price: 299.99, stock: 0, category: "electronics" },
];

var discountCodes: any = {
  "SAVE10": { percent: 10, minOrder: 50, active: true },
  "HALF50": { percent: 50, minOrder: 100, active: false },
  "FREE20": { percent: 20, minOrder: 0, active: true },
};

// --------------------------------------------------------------------------
// BUG 1: Off-by-one error & wrong comparison operator
// The loop skips the last item and uses assignment (=) instead of
// comparison (===) for the category filter.
// --------------------------------------------------------------------------
export function getInventoryByCategory(req: Request, res: Response) {
  var category = req.query.category as string;
  var results: any[] = [];
  for (var i = 0; i < inventory.length - 1; i++) {
    if (inventory[i].category = category) {
      results.push(inventory[i]);
    }
  }
  res.json(results);
}

// --------------------------------------------------------------------------
// BUG 2: NaN propagation & missing null check
// Applying a discount to an item with undefined price produces NaN, and
// the function crashes when an invalid product ID is provided because
// `product` is null when accessed.
// --------------------------------------------------------------------------
export function applyDiscount(req: Request, res: Response) {
  var productId = req.body.productId;
  var discountCode = req.body.code as string;

  var product = null;
  for (var i = 0; i < inventory.length; i++) {
    if (inventory[i].id == productId) {
      product = inventory[i];
    }
  }

  var discount = discountCodes[discountCode];

  var discountedPrice = product.price - (product.price * discount.percent / 100);

  res.json({
    product: product.name,
    originalPrice: product.price,
    discountedPrice: discountedPrice,
  });
}

// --------------------------------------------------------------------------
// BUG 3: Infinite loop
// The while loop increments `total` but never increments `i`, so it runs
// forever and hangs the server.
// --------------------------------------------------------------------------
export function calculateInventoryValue(req: Request, res: Response) {
  var total = 0;
  var i = 0;
  while (i < inventory.length) {
    total = total + (inventory[i].price * inventory[i].stock);
    // BUG: forgot to increment i
  }
  res.json({ totalValue: total });
}

// --------------------------------------------------------------------------
// BUG 4: Async/callback mishandling
// The function returns a response BEFORE the async operations complete,
// so the client always gets an empty array. Also, errors inside the
// timeout are silently swallowed.
// --------------------------------------------------------------------------
export function getStockAlerts(req: Request, res: Response) {
  var alerts: any[] = [];

  for (var i = 0; i < inventory.length; i++) {
    setTimeout(function () {
      if (inventory[i] && inventory[i].stock <= 10) {
        alerts.push({
          id: inventory[i].id,
          name: inventory[i].name,
          stock: inventory[i].stock,
        });
      }
    }, 100);
  }

  // BUG: responds immediately, before setTimeout callbacks fire
  res.json({ alerts: alerts });
}

// --------------------------------------------------------------------------
// BUG 5: Incorrect sorting (string vs numeric comparison)
// Sorting prices as strings produces wrong order: "49.99" < "4.99" < "999.99"
// because string comparison is character-by-character.
// --------------------------------------------------------------------------
export function getProductsSortedByPrice(req: Request, res: Response) {
  var sorted = inventory.slice();
  sorted.sort(function (a: any, b: any) {
    return String(a.price).localeCompare(String(b.price));
  });
  res.json(sorted);
}

// --------------------------------------------------------------------------
// BUG 6: Shallow copy mutation
// The "updated" object is actually a reference to the original, so the
// original inventory item gets silently mutated. Also, the spread operator
// is applied incorrectly — spreading into an array instead of an object.
// --------------------------------------------------------------------------
export function previewPriceIncrease(req: Request, res: Response) {
  var percent = parseFloat(req.query.percent as string);
  var previews: any[] = [];

  for (var i = 0; i < inventory.length; i++) {
    var item = inventory[i]; // shallow reference, not a copy!
    item.price = item.price * (1 + percent / 100);
    previews.push(item);
  }

  res.json({
    message: "Preview only — original prices NOT changed",
    previews: previews,
  });
}

// --------------------------------------------------------------------------
// BUG 7: Type coercion & truthy/falsy confusion
// The stock check `if (product.stock)` evaluates to false when stock is 0,
// incorrectly treating "0 in stock" the same as "stock is missing".
// The quantity check `quantity == "0"` passes for the number 0 due to
// loose equality, preventing legitimate zero-quantity clears.
// --------------------------------------------------------------------------
export function processOrder(req: Request, res: Response) {
  var productId = req.body.productId;
  var quantity = req.body.quantity;

  var product = null;
  for (var i = 0; i < inventory.length; i++) {
    if (inventory[i].id == productId) {
      product = inventory[i];
    }
  }

  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  if (quantity == "0") {
    res.status(400).json({ error: "Quantity cannot be zero" });
    return;
  }

  if (product.stock) {
    // BUG: this is false when stock === 0, which incorrectly reports "out of stock"
    product.stock = product.stock - quantity;
    res.json({ message: "Order placed", remaining: product.stock });
  } else {
    res.status(400).json({ error: "Product is out of stock" });
  }
}

// --------------------------------------------------------------------------
// BUG 8: Unhandled promise rejection & swallowed errors
// The async function has no try/catch and the .catch() handler doesn't
// send an error response, leaving the client hanging with no reply.
// --------------------------------------------------------------------------
export async function fetchExternalPricing(req: Request, res: Response) {
  var productId = req.params.id;

  var response = await fetch("https://api.pricing.invalid/products/" + productId);
  var data = await response.json();

  res.json(data);
}
