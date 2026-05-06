// kooza Servis — Naif için OWNER hesabı
const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcrypt')

const prisma = new PrismaClient()

;(async () => {
  try {
    const email = 'm.naif_barut@hotmail.com'
    const password = 'Naif2026'

    // Mevcut user'ı temizle
    const existing = await prisma.user.findFirst({ where: { email } })
    if (existing) {
      console.log('⚠️  Mevcut hesap bulundu, siliniyor...')
      const tid = existing.tenantId
      await prisma.user.delete({ where: { id: existing.id } }).catch(() => {})
      if (tid) {
        await prisma.tenant.delete({ where: { id: tid } }).catch(() => {})
      }
      console.log('  silindi.\n')
    }

    const hash = await bcrypt.hash(password, 12)
    const trialEnd = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 yıl

    console.log('1. Tenant (restoran) oluşturuluyor...')
    const tenant = await prisma.tenant.create({
      data: {
        name: 'Naif Restoran',
        slug: 'naif-restoran-' + Date.now().toString(36),
        email,
        phone: '05414142942',
        currency: 'TRY',
        timezone: 'Europe/Istanbul',
        locale: 'tr',
        isActive: true,
        trialEndsAt: trialEnd,
      },
    })
    console.log('✅ Tenant:', { id: tenant.id, name: tenant.name, slug: tenant.slug })

    console.log('\n2. Owner kullanıcı oluşturuluyor...')
    const user = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        email,
        passwordHash: hash,
        firstName: 'Muhammet Naif',
        lastName: 'Barut',
        phone: '05414142942',
        role: 'OWNER',
        isActive: true,
      },
    })
    console.log('✅ User:', { id: user.id, email: user.email, role: user.role })

    console.log('\n🎉 BAŞARILI! Giriş bilgileri:')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('URL:    https://servis.kooza.tr')
    console.log('Email:  m.naif_barut@hotmail.com')
    console.log('Şifre:  Naif2026')
    console.log('Rol:    OWNER · Naif Restoran')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━')
  } catch (e) {
    console.error('❌', e.message)
    if (e.code) console.error('   code:', e.code)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
})()
