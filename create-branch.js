// Naif kullanıcısına default branch ata
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

;(async () => {
  try {
    const user = await prisma.user.findFirst({ where: { email: 'm.naif_barut@hotmail.com' } })
    if (!user) { console.log('❌ User yok'); return }
    console.log('User:', user.id, 'mevcut branchId:', user.branchId)

    let branch
    if (user.branchId) {
      branch = await prisma.branch.findUnique({ where: { id: user.branchId } })
      console.log('Branch zaten var:', branch?.name)
    } else {
      branch = await prisma.branch.create({
        data: {
          tenantId: user.tenantId,
          name: 'Naif Restoran — Merkez',
          code: 'MERKEZ',
          isActive: true,
          openTime: '09:00',
          closeTime: '23:00',
        },
      })
      console.log('✅ Branch oluşturuldu:', branch.id, branch.name)
      await prisma.user.update({ where: { id: user.id }, data: { branchId: branch.id } })
      console.log('✅ User branch\'a bağlandı')
    }

    console.log('\n🎉 Tamam! User artık branch\'lı.')
  } catch (e) {
    console.error('❌', e.message)
  } finally {
    await prisma.$disconnect()
  }
})()
