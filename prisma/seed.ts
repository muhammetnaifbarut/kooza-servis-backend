/**
 * Hizmet Kasa — Demo Seed
 * Çalıştır: npm run prisma:seed
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // ── Subscription Plans ─────────────────────────────────
  const plans = [
    {
      name: 'Starter', slug: 'starter',
      description: 'Küçük işletmeler için başlangıç paketi',
      price: 0, maxBranches: 1, maxUsers: 3, maxProducts: 50,
      features: ['pos', 'kitchen'],
    },
    {
      name: 'Business', slug: 'business',
      description: 'Büyüyen işletmeler için kapsamlı paket',
      price: 299, maxBranches: 3, maxUsers: 15, maxProducts: 500,
      features: ['pos', 'kitchen', 'stock', 'crm', 'reports', 'qr-menu'],
    },
    {
      name: 'Enterprise', slug: 'enterprise',
      description: 'Zincir ve franchise işletmeler için',
      price: 799, maxBranches: 999, maxUsers: 999, maxProducts: 9999,
      features: ['pos', 'kitchen', 'stock', 'crm', 'reports', 'qr-menu', 'ai', 'online-orders', 'franchise', 'api'],
    },
  ];

  for (const plan of plans) {
    await prisma.subscriptionPlan.upsert({
      where: { slug: plan.slug },
      create: plan,
      update: { price: plan.price, features: plan.features },
    });
  }
  console.log('✅ Planlar oluşturuldu');

  // ── Demo Tenant ────────────────────────────────────────
  let tenant = await prisma.tenant.findUnique({ where: { slug: 'demo-restoran' } });

  if (!tenant) {
    const passwordHash = await bcrypt.hash('demo1234', 12);
    const businessPlan = await prisma.subscriptionPlan.findUnique({ where: { slug: 'business' } });

    tenant = await prisma.tenant.create({
      data: {
        name: 'Demo Restoran',
        slug: 'demo-restoran',
        email: 'demo@hizmetkasa.com',
        phone: '0212 555 00 00',
        address: 'Bağcılar, İstanbul',
        currency: 'TRY',
        timezone: 'Europe/Istanbul',
        locale: 'tr',
        trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        settings: {
          create: {
            taxRate: 18,
            serviceCharge: 0,
            loyaltyEnabled: true,
            loyaltyRate: 1,
            qrMenuEnabled: true,
            onlineOrdersEnabled: false,
          },
        },
      },
    });

    if (businessPlan) {
      await prisma.subscription.create({
        data: {
          tenantId: tenant.id,
          planId: businessPlan.id,
          status: 'TRIALING',
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        },
      });
    }

    // Branch
    const branch = await prisma.branch.create({
      data: {
        tenantId: tenant.id,
        name: 'Merkez Şube',
        code: 'MERKEZ',
        address: 'Bağcılar, İstanbul',
        phone: '0212 555 00 01',
        openTime: '08:00',
        closeTime: '23:00',
        isActive: true,
      },
    });

    // Users
    await prisma.user.create({
      data: {
        tenantId: tenant.id, branchId: branch.id,
        email: 'demo@hizmetkasa.com',
        firstName: 'Demo', lastName: 'Sahip',
        passwordHash, role: 'OWNER', isActive: true,
      },
    });
    await prisma.user.create({
      data: {
        tenantId: tenant.id, branchId: branch.id,
        email: 'mudur@demo.com',
        firstName: 'Ahmet', lastName: 'Müdür',
        passwordHash, role: 'MANAGER', isActive: true,
      },
    });
    await prisma.user.create({
      data: {
        tenantId: tenant.id, branchId: branch.id,
        email: 'garson1@demo.com',
        firstName: 'Mehmet', lastName: 'Yılmaz',
        passwordHash, role: 'WAITER', isActive: true,
      },
    });
    await prisma.user.create({
      data: {
        tenantId: tenant.id, branchId: branch.id,
        email: 'mutfak1@demo.com',
        firstName: 'Kadir', lastName: 'Kaya',
        passwordHash, role: 'KITCHEN', isActive: true,
      },
    });
    await prisma.user.create({
      data: {
        tenantId: tenant.id, branchId: branch.id,
        email: 'kasiyer1@demo.com',
        firstName: 'Fatma', lastName: 'Demir',
        passwordHash, role: 'CASHIER', isActive: true,
      },
    });
    console.log('✅ Kullanıcılar oluşturuldu');

    // Categories
    const categories = await Promise.all([
      prisma.category.create({ data: { tenantId: tenant.id, name: 'Ana Yemekler', color: '#ef4444', sortOrder: 1, icon: '🍽️' } }),
      prisma.category.create({ data: { tenantId: tenant.id, name: 'Çorbalar',     color: '#f97316', sortOrder: 2, icon: '🍵' } }),
      prisma.category.create({ data: { tenantId: tenant.id, name: 'Izgara',       color: '#dc2626', sortOrder: 3, icon: '🥩' } }),
      prisma.category.create({ data: { tenantId: tenant.id, name: 'Salatalar',    color: '#22c55e', sortOrder: 4, icon: '🥗' } }),
      prisma.category.create({ data: { tenantId: tenant.id, name: 'İçecekler',    color: '#3b82f6', sortOrder: 5, icon: '🥤' } }),
      prisma.category.create({ data: { tenantId: tenant.id, name: 'Tatlılar',     color: '#a855f7', sortOrder: 6, icon: '🍰' } }),
      prisma.category.create({ data: { tenantId: tenant.id, name: 'Kahvaltı',     color: '#eab308', sortOrder: 7, icon: '🥞' } }),
    ]);

    // Products
    const productList = [
      // Ana Yemekler
      { name: 'Köfte',             categoryId: categories[0].id, price: 85,  cost: 28,  type: 'FOOD',    taxRate: 8,  preparationTime: 10 },
      { name: 'Lahmacun',          categoryId: categories[0].id, price: 35,  cost: 10,  type: 'FOOD',    taxRate: 8,  preparationTime: 8  },
      { name: 'Pide (Peynirli)',   categoryId: categories[0].id, price: 55,  cost: 18,  type: 'FOOD',    taxRate: 8,  preparationTime: 10 },
      { name: 'Döner (Porsiyon)',  categoryId: categories[0].id, price: 90,  cost: 30,  type: 'FOOD',    taxRate: 8,  preparationTime: 5  },
      // Çorbalar
      { name: 'Mercimek Çorbası', categoryId: categories[1].id, price: 45,  cost: 10,  type: 'FOOD',    taxRate: 8,  preparationTime: 5  },
      { name: 'Domates Çorbası',  categoryId: categories[1].id, price: 50,  cost: 12,  type: 'FOOD',    taxRate: 8,  preparationTime: 5  },
      { name: 'İşkembe Çorbası',  categoryId: categories[1].id, price: 55,  cost: 14,  type: 'FOOD',    taxRate: 8,  preparationTime: 5  },
      // Izgara
      { name: 'Adana Kebap',      categoryId: categories[2].id, price: 120, cost: 45,  type: 'FOOD',    taxRate: 8,  preparationTime: 15 },
      { name: 'Urfa Kebap',       categoryId: categories[2].id, price: 115, cost: 42,  type: 'FOOD',    taxRate: 8,  preparationTime: 15 },
      { name: 'Kanat Izgara',     categoryId: categories[2].id, price: 95,  cost: 32,  type: 'FOOD',    taxRate: 8,  preparationTime: 12 },
      { name: 'Kuzu Şiş',        categoryId: categories[2].id, price: 150, cost: 65,  type: 'FOOD',    taxRate: 8,  preparationTime: 20 },
      { name: 'Izgara Tavuk',     categoryId: categories[2].id, price: 110, cost: 38,  type: 'FOOD',    taxRate: 8,  preparationTime: 12 },
      // Salatalar
      { name: 'Çoban Salatası',   categoryId: categories[3].id, price: 35,  cost: 10,  type: 'FOOD',    taxRate: 8,  preparationTime: 5  },
      { name: 'Mevsim Salatası',  categoryId: categories[3].id, price: 40,  cost: 12,  type: 'FOOD',    taxRate: 8,  preparationTime: 5  },
      { name: 'Patlıcan Salatası',categoryId: categories[3].id, price: 45,  cost: 13,  type: 'FOOD',    taxRate: 8,  preparationTime: 5  },
      // İçecekler
      { name: 'Ayran',            categoryId: categories[4].id, price: 20,  cost: 5,   type: 'DRINK',   taxRate: 18, preparationTime: 2  },
      { name: 'Kola (Büyük)',     categoryId: categories[4].id, price: 30,  cost: 8,   type: 'DRINK',   taxRate: 18, preparationTime: 1  },
      { name: 'Çay',              categoryId: categories[4].id, price: 15,  cost: 2,   type: 'DRINK',   taxRate: 18, preparationTime: 3  },
      { name: 'Türk Kahvesi',     categoryId: categories[4].id, price: 35,  cost: 8,   type: 'DRINK',   taxRate: 18, preparationTime: 5  },
      { name: 'Meyve Suyu',       categoryId: categories[4].id, price: 25,  cost: 6,   type: 'DRINK',   taxRate: 18, preparationTime: 2  },
      { name: 'Su',               categoryId: categories[4].id, price: 10,  cost: 1,   type: 'DRINK',   taxRate: 18, preparationTime: 1  },
      // Tatlılar
      { name: 'Baklava (Porsiyon)', categoryId: categories[5].id, price: 65, cost: 20, type: 'DESSERT', taxRate: 18, preparationTime: 3 },
      { name: 'Künefe',             categoryId: categories[5].id, price: 70, cost: 22, type: 'DESSERT', taxRate: 18, preparationTime: 8 },
      { name: 'Sütlaç',             categoryId: categories[5].id, price: 45, cost: 12, type: 'DESSERT', taxRate: 18, preparationTime: 3 },
      { name: 'Dondurma',           categoryId: categories[5].id, price: 40, cost: 10, type: 'DESSERT', taxRate: 18, preparationTime: 2 },
      // Kahvaltı
      { name: 'Serpme Kahvaltı',  categoryId: categories[6].id, price: 180, cost: 65, type: 'FOOD',    taxRate: 8,  preparationTime: 15 },
      { name: 'Menemen',          categoryId: categories[6].id, price: 55,  cost: 15, type: 'FOOD',    taxRate: 8,  preparationTime: 8  },
    ];

    const productMap: Record<string, any> = {};
    for (const p of productList) {
      const product = await prisma.product.create({
        data: { tenantId: tenant.id, isAvailable: true, ...p },
      });
      productMap[p.name] = product;
    }
    console.log(`✅ ${productList.length} ürün oluşturuldu`);

    // Tables
    const tableData = [
      { name: 'Masa 1',  section: 'İç Mekan', capacity: 2, shape: 'SQUARE',    status: 'EMPTY',    posX: 20,  posY: 20  },
      { name: 'Masa 2',  section: 'İç Mekan', capacity: 4, shape: 'SQUARE',    status: 'OCCUPIED', posX: 170, posY: 20  },
      { name: 'Masa 3',  section: 'İç Mekan', capacity: 4, shape: 'SQUARE',    status: 'EMPTY',    posX: 320, posY: 20  },
      { name: 'Masa 4',  section: 'İç Mekan', capacity: 6, shape: 'RECTANGLE', status: 'OCCUPIED', posX: 20,  posY: 170 },
      { name: 'Masa 5',  section: 'İç Mekan', capacity: 4, shape: 'SQUARE',    status: 'EMPTY',    posX: 170, posY: 170 },
      { name: 'Masa 6',  section: 'İç Mekan', capacity: 2, shape: 'ROUND',     status: 'RESERVED', posX: 320, posY: 170 },
      { name: 'Teras 1', section: 'Teras',    capacity: 4, shape: 'SQUARE',    status: 'EMPTY',    posX: 20,  posY: 20  },
      { name: 'Teras 2', section: 'Teras',    capacity: 4, shape: 'SQUARE',    status: 'OCCUPIED', posX: 170, posY: 20  },
      { name: 'Teras 3', section: 'Teras',    capacity: 6, shape: 'RECTANGLE', status: 'EMPTY',    posX: 320, posY: 20  },
      { name: 'Teras 4', section: 'Teras',    capacity: 2, shape: 'ROUND',     status: 'EMPTY',    posX: 20,  posY: 170 },
      { name: 'VIP 1',   section: 'VIP',      capacity: 8, shape: 'RECTANGLE', status: 'RESERVED', posX: 20,  posY: 20  },
      { name: 'VIP 2',   section: 'VIP',      capacity: 10,shape: 'RECTANGLE', status: 'EMPTY',    posX: 250, posY: 20  },
    ];

    const tables: any[] = [];
    for (const t of tableData) {
      const table = await prisma.restaurantTable.create({
        data: { branchId: branch.id, tenantId: tenant.id, ...t as any },
      });
      tables.push(table);
    }
    console.log(`✅ ${tables.length} masa oluşturuldu`);

    // Customers
    const customerList = [
      { firstName: 'Ali',     lastName: 'Yıldız',  phone: '05301234567', loyaltyPoints: 250, visitCount: 12, totalSpent: 1250 },
      { firstName: 'Ayşe',    lastName: 'Kara',    phone: '05321234567', loyaltyPoints: 180, visitCount: 8,  totalSpent: 860  },
      { firstName: 'Mustafa', lastName: 'Çelik',   phone: '05341234567', loyaltyPoints: 420, visitCount: 20, totalSpent: 2100 },
      { firstName: 'Zeynep',  lastName: 'Arslan',  phone: '05351234567', loyaltyPoints: 90,  visitCount: 5,  totalSpent: 450  },
      { firstName: 'Emre',    lastName: 'Şahin',   phone: '05361234567', loyaltyPoints: 310, visitCount: 15, totalSpent: 1580 },
      { firstName: 'Seda',    lastName: 'Aydın',   phone: '05371234567', loyaltyPoints: 145, visitCount: 7,  totalSpent: 720  },
      { firstName: 'Burak',   lastName: 'Koç',     phone: '05381234567', loyaltyPoints: 55,  visitCount: 3,  totalSpent: 280  },
      { firstName: 'Merve',   lastName: 'Özdemir', phone: '05391234567', loyaltyPoints: 500, visitCount: 25, totalSpent: 3200 },
    ];

    for (const c of customerList) {
      await prisma.customer.create({
        data: { tenantId: tenant.id, isActive: true, ...c },
      });
    }
    console.log(`✅ ${customerList.length} müşteri oluşturuldu`);

    // Financial accounts
    await prisma.financialAccount.create({
      data: { tenantId: tenant.id, name: 'Ana Kasa', type: 'CASH' as any, balance: 15000, currency: 'TRY', isDefault: true },
    });
    await prisma.financialAccount.create({
      data: { tenantId: tenant.id, name: 'POS Terminal', type: 'BANK' as any, balance: 42500, currency: 'TRY' },
    });
    console.log('✅ Finansal hesaplar oluşturuldu');

    // Campaigns
    await prisma.campaign.create({
      data: {
        tenantId: tenant.id,
        name: 'Hoşgeldin İndirimi',
        description: 'İlk siparişinize özel %15 indirim',
        type: 'DISCOUNT_PERCENT' as any,
        discount: 15,
        isActive: true,
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });
    await prisma.campaign.create({
      data: {
        tenantId: tenant.id,
        name: 'Hafta Sonu Özel',
        description: 'Cumartesi-Pazar içeceklerde %20 indirim',
        type: 'DISCOUNT_PERCENT' as any,
        discount: 20,
        isActive: true,
        startDate: new Date(),
        endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      },
    });
    console.log('✅ Kampanyalar oluşturuldu');

    // Stock Items
    const stockItems = [
      { name: 'Et (kg)',         unit: 'kg',   quantity: 25,  minQuantity: 10, maxQuantity: 100 },
      { name: 'Tavuk (kg)',      unit: 'kg',   quantity: 18,  minQuantity: 8,  maxQuantity: 80  },
      { name: 'Domates (kg)',    unit: 'kg',   quantity: 12,  minQuantity: 5,  maxQuantity: 50  },
      { name: 'Soğan (kg)',      unit: 'kg',   quantity: 8,   minQuantity: 5,  maxQuantity: 50  },
      { name: 'Un (kg)',         unit: 'kg',   quantity: 30,  minQuantity: 15, maxQuantity: 150 },
      { name: 'Kola (koli)',     unit: 'koli', quantity: 6,   minQuantity: 3,  maxQuantity: 30  },
      { name: 'Su (koli)',       unit: 'koli', quantity: 10,  minQuantity: 5,  maxQuantity: 50  },
      { name: 'Ayran (lt)',      unit: 'lt',   quantity: 20,  minQuantity: 10, maxQuantity: 100 },
      { name: 'Peynir (kg)',     unit: 'kg',   quantity: 4,   minQuantity: 2,  maxQuantity: 20  },
      { name: 'Yağ (lt)',        unit: 'lt',   quantity: 15,  minQuantity: 5,  maxQuantity: 50  },
      { name: 'Ekmek (adet)',    unit: 'adet', quantity: 50,  minQuantity: 20, maxQuantity: 200 },
      { name: 'Mercimek (kg)',   unit: 'kg',   quantity: 3,   minQuantity: 5,  maxQuantity: 50  }, // Kritik stok!
    ];

    for (const item of stockItems) {
      await prisma.stockItem.create({
        data: { tenantId: tenant.id, branchId: branch.id, ...item },
      });
    }
    console.log(`✅ ${stockItems.length} stok kalemi oluşturuldu`);

    console.log('\n🎉 Demo tenant oluşturuldu: demo-restoran');
    console.log('   Email: demo@hizmetkasa.com | Şifre: demo1234');
    console.log('   Diğer kullanıcılar: garson1@demo.com, mutfak1@demo.com, kasiyer1@demo.com');
    console.log('   Şifre: demo1234\n');
  } else {
    console.log('ℹ️  demo-restoran tenant zaten mevcut, atlanıyor...');
  }

  console.log('🌱 Seed işlemi tamamlandı!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
