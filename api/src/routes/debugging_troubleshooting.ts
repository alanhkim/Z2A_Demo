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
// FIX 1: Off-by-one error & wrong comparison operator
// Use `inventory.length` (not `inventory.length - 1`) so the last item is
// included, and use `===` for strict equality comparison.
// --------------------------------------------------------------------------
export function getInventoryByCategory(req: Request, res: Response) {
  var category = req.query.category as string;
  var results: any[] = [];
  for (var i = 0; i < inventory.length; i++) {
    if (inventory[i].category === category) {
      results.push(inventory[i]);
    }
  }
  res.json(results);
}

// --------------------------------------------------------------------------
// FIX 2: NaN propagation & missing null check
// Return 404 when product or discount code is not found, and return 400
// when the product price is undefined (NaN would propagate otherwise).
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

  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  if (product.price === undefined || product.price === null) {
    res.status(400).json({ error: "Product price is not available" });
    return;
  }

  var discount = discountCodes[discountCode];

  if (!discount) {
    res.status(400).json({ error: "Invalid discount code" });
    return;
  }

  var discountedPrice = product.price - (product.price * discount.percent / 100);

  res.json({
    product: product.name,
    originalPrice: product.price,
    discountedPrice: discountedPrice,
  });
}

// --------------------------------------------------------------------------
// FIX 3: Infinite loop
// Added `i++` inside the while loop so the index advances each iteration.
// Also guard against undefined prices to avoid NaN in the total.
// --------------------------------------------------------------------------
export function calculateInventoryValue(req: Request, res: Response) {
  var total = 0;
  var i = 0;
  while (i < inventory.length) {
    var price = inventory[i].price || 0;
    total = total + (price * inventory[i].stock);
    i++;
  }
  res.json({ totalValue: total });
}

// --------------------------------------------------------------------------
// FIX 4: Async/callback mishandling
// Process stock checks synchronously instead of deferring them via
// setTimeout, so the response contains the correct data.
// --------------------------------------------------------------------------
export function getStockAlerts(req: Request, res: Response) {
  var alerts: any[] = [];

  for (var i = 0; i < inventory.length; i++) {
    var item = inventory[i];
    if (item.stock <= 10) {
      alerts.push({
        id: item.id,
        name: item.name,
        stock: item.stock,
      });
    }
  }

  res.json({ alerts: alerts });
}

// --------------------------------------------------------------------------
// FIX 5: Incorrect sorting (string vs numeric comparison)
// Use numeric subtraction `a.price - b.price` instead of localeCompare
// so items sort by actual numeric value.
// --------------------------------------------------------------------------
export function getProductsSortedByPrice(req: Request, res: Response) {
  var sorted = inventory.slice();
  sorted.sort(function (a: any, b: any) {
    return a.price - b.price;
  });
  res.json(sorted);
}

// --------------------------------------------------------------------------
// FIX 6: Shallow copy mutation
// Use spread operator `{ ...inventory[i] }` to create a shallow copy of
// each item so the original inventory is not mutated.
// --------------------------------------------------------------------------
export function previewPriceIncrease(req: Request, res: Response) {
  var percent = parseFloat(req.query.percent as string);
  var previews: any[] = [];

  for (var i = 0; i < inventory.length; i++) {
    var item = { ...inventory[i] }; // shallow copy, not a reference
    item.price = item.price * (1 + percent / 100);
    previews.push(item);
  }

  res.json({
    message: "Preview only — original prices NOT changed",
    previews: previews,
  });
}

// --------------------------------------------------------------------------
// FIX 7: Type coercion & truthy/falsy confusion
// Use strict equality `=== 0` for the quantity check and `product.stock > 0`
// for the stock check so that a stock value of 0 is correctly treated as
// "out of stock" without falsely catching other falsy values.
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

  if (quantity === 0) {
    res.status(400).json({ error: "Quantity cannot be zero" });
    return;
  }

  if (product.stock > 0) {
    product.stock = product.stock - quantity;
    res.json({ message: "Order placed", remaining: product.stock });
  } else {
    res.status(400).json({ error: "Product is out of stock" });
  }
}

// --------------------------------------------------------------------------
// FIX 8: Unhandled promise rejection & swallowed errors
// Wrap the async fetch in a try/catch and send a proper error response
// so the client is never left hanging.
// Also validate productId to prevent SSRF via URL injection.
// --------------------------------------------------------------------------
export async function fetchExternalPricing(req: Request, res: Response) {
  var productId = req.params.id;

  if (!/^\d+$/.test(productId)) {
    res.status(400).json({ error: "Invalid product ID" });
    return;
  }

  try {
    var response = await fetch("https://api.pricing.invalid/products/" + encodeURIComponent(productId));
    var data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: "Failed to fetch external pricing" });
  }
}
