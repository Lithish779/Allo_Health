// prisma/seed.js
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Clean existing data
  await prisma.reservation.deleteMany();
  await prisma.stock.deleteMany();
  await prisma.product.deleteMany();
  await prisma.warehouse.deleteMany();

  // Warehouses
  const delhi = await prisma.warehouse.create({
    data: { id: 'wh-delhi', name: 'Delhi Central', location: 'New Delhi, India' },
  });
  const mumbai = await prisma.warehouse.create({
    data: { id: 'wh-mumbai', name: 'Mumbai West', location: 'Mumbai, India' },
  });
  const bangalore = await prisma.warehouse.create({
    data: { id: 'wh-blr', name: 'Bangalore Hub', location: 'Bangalore, India' },
  });

  // Products
  const products = [
    {
      id: 'prod-001',
      name: 'Ergonomic Mesh Chair',
      description: 'Lumbar support, adjustable armrests, breathable mesh back. Perfect for long work sessions.',
      price: 18999,
      imageUrl: null,
    },
    {
      id: 'prod-002',
      name: 'Mechanical Keyboard TKL',
      description: 'Tenkeyless layout, tactile switches, RGB backlit, aluminium frame.',
      price: 7499,
      imageUrl: null,
    },
    {
      id: 'prod-003',
      name: '4K Monitor 27"',
      description: 'IPS panel, 144Hz refresh rate, HDR400, USB-C charging 90W.',
      price: 34999,
      imageUrl: null,
    },
    {
      id: 'prod-004',
      name: 'Standing Desk Frame',
      description: 'Motorised dual-motor frame, height 60–125 cm, anti-collision sensor.',
      price: 24999,
      imageUrl: null,
    },
    {
      id: 'prod-005',
      name: 'Wireless Trackball Mouse',
      description: '57mm ball, Bluetooth + USB-C dongle, 70-day battery, 8 programmable buttons.',
      price: 5999,
      imageUrl: null,
    },
    {
      id: 'prod-006',
      name: 'Laptop Arm Mount',
      description: 'Single arm, VESA 75/100, supports up to 9 kg, full motion range.',
      price: 3299,
      imageUrl: null,
    },
  ];

  for (const p of products) {
    await prisma.product.create({ data: p });
  }

  // Stock levels — some scarce on purpose to demo race conditions
  const stockData = [
    { productId: 'prod-001', warehouseId: 'wh-delhi',  totalUnits: 12 },
    { productId: 'prod-001', warehouseId: 'wh-mumbai', totalUnits: 8  },
    { productId: 'prod-001', warehouseId: 'wh-blr',    totalUnits: 5  },
    { productId: 'prod-002', warehouseId: 'wh-delhi',  totalUnits: 20 },
    { productId: 'prod-002', warehouseId: 'wh-mumbai', totalUnits: 15 },
    { productId: 'prod-002', warehouseId: 'wh-blr',    totalUnits: 1  }, // scarce
    { productId: 'prod-003', warehouseId: 'wh-delhi',  totalUnits: 3  }, // scarce
    { productId: 'prod-003', warehouseId: 'wh-mumbai', totalUnits: 7  },
    { productId: 'prod-003', warehouseId: 'wh-blr',    totalUnits: 4  },
    { productId: 'prod-004', warehouseId: 'wh-delhi',  totalUnits: 6  },
    { productId: 'prod-004', warehouseId: 'wh-mumbai', totalUnits: 0  }, // out of stock
    { productId: 'prod-004', warehouseId: 'wh-blr',    totalUnits: 9  },
    { productId: 'prod-005', warehouseId: 'wh-delhi',  totalUnits: 30 },
    { productId: 'prod-005', warehouseId: 'wh-mumbai', totalUnits: 25 },
    { productId: 'prod-005', warehouseId: 'wh-blr',    totalUnits: 2  }, // scarce
    { productId: 'prod-006', warehouseId: 'wh-delhi',  totalUnits: 18 },
    { productId: 'prod-006', warehouseId: 'wh-mumbai', totalUnits: 11 },
    { productId: 'prod-006', warehouseId: 'wh-blr',    totalUnits: 14 },
  ];

  for (const s of stockData) {
    await prisma.stock.create({ data: { ...s, reservedUnits: 0 } });
  }

  console.log(`Seeded ${products.length} products, 3 warehouses, ${stockData.length} stock records.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
