/**
 * kooza Servis — Demo veri seed
 * Mevcut "Hizmet Kasa" demo verilerini KOOZA branding'e güncellemekle yetinir.
 * (Foreign key cascade olmadığı için silmiyoruz — yerinde update.)
 */

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🦋 kooza Servis — Demo rebrand başlıyor...');

  const password = 'demo1234';
  const passwordHash = await bcrypt.hash(password, 12);

  // ─── Mevcut demo tenant'ı bul / oluştur ─────────────────
  // Önce eski Hizmet Kasa demo'sunu ara, yoksa yeni oluştur
  let tenant = await prisma.tenant.findFirst({
    where: {
      OR: [
        { slug: 'demo' },
        { slug: 'demo-cafe' },
        { slug: 'kooza-servis' },
        { name: { contains: 'Demo', mode: 'insensitive' } },
      ],
    },
  });

  if (tenant) {
    // Var olan tenant'ı kooza brand'ına güncelle
    tenant = await prisma.tenant.update({
      where: { id: tenant.id },
      data: {
        name: 'kooza Servis Demo',
        slug: 'kooza-servis',
        email: 'demo@kooza.tr',
        locale: 'tr',
        isActive: true,
      } as any,
    });
    console.log(`✓ Tenant rebrand: kooza Servis Demo (id: ${tenant.id.slice(0, 8)}...)`);
  } else {
    tenant = await prisma.tenant.create({
      data: {
        name: 'kooza Servis Demo',
        slug: 'kooza-servis',
        email: 'demo@kooza.tr',
        currency: 'TRY',
        timezone: 'Europe/Istanbul',
        locale: 'tr',
      } as any,
    });
    console.log(`✓ Tenant oluşturuldu: kooza Servis Demo`);
  }

  // ─── Demo kullanıcılar — kooza Servis branded ─────────────
  // Eski email → yeni email + yeni isim eşlemesi
  const userMappings = [
    { oldEmails: ['demo@hizmetkasa.com'],            email: 'sahip@kooza.tr',   firstName: 'Sahip',  lastName: 'Patron',  role: 'OWNER'   },
    { oldEmails: ['mudur@demo.com', 'mudur@kooza.tr'], email: 'mudur@kooza.tr',   firstName: 'Ahmet',  lastName: 'Müdür',   role: 'MANAGER' },
    { oldEmails: ['garson1@demo.com', 'garson@kooza.tr'], email: 'garson@kooza.tr',  firstName: 'Mehmet', lastName: 'Garson',  role: 'WAITER'  },
    { oldEmails: ['mutfak1@demo.com', 'mutfak@kooza.tr'], email: 'mutfak@kooza.tr',  firstName: 'Kadir',  lastName: 'Mutfak',  role: 'KITCHEN' },
    { oldEmails: ['kasiyer1@demo.com', 'kasiyer@kooza.tr'], email: 'kasiyer@kooza.tr', firstName: 'Fatma',  lastName: 'Kasiyer', role: 'CASHIER' },
  ];

  for (const m of userMappings) {
    // Eski user'ı bul
    let existing = null as any;
    for (const oldEmail of m.oldEmails) {
      existing = await prisma.user.findFirst({
        where: { tenantId: tenant.id, email: oldEmail },
      });
      if (existing) break;
    }

    if (existing) {
      // Update
      await prisma.user.update({
        where: { id: existing.id },
        data: {
          email: m.email,
          firstName: m.firstName,
          lastName: m.lastName,
          passwordHash,
          role: m.role as any,
          isActive: true,
        } as any,
      });
      console.log(`✓ Update:  ${m.role.padEnd(8)} → ${m.email}`);
    } else {
      // Create
      await prisma.user.create({
        data: {
          tenantId: tenant.id,
          email: m.email,
          firstName: m.firstName,
          lastName: m.lastName,
          passwordHash,
          role: m.role as any,
          isActive: true,
        } as any,
      });
      console.log(`✓ Create:  ${m.role.padEnd(8)} → ${m.email}`);
    }
  }

  console.log('');
  console.log('═══════════════════════════════════════════════');
  console.log('  🦋 kooza Servis Demo — Hazır');
  console.log('═══════════════════════════════════════════════');
  console.log('  🛡 Sahip:    sahip@kooza.tr');
  console.log('  👔 Müdür:    mudur@kooza.tr');
  console.log('  🧑‍🍳 Garson:   garson@kooza.tr');
  console.log('  👨‍🍳 Mutfak:   mutfak@kooza.tr');
  console.log('  💳 Kasiyer:  kasiyer@kooza.tr');
  console.log('───────────────────────────────────────────────');
  console.log('  Ortak şifre: demo1234');
  console.log('═══════════════════════════════════════════════');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
