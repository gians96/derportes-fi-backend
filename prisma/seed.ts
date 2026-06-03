import { PrismaClient, Role } from '@prisma/client';

const prisma = new PrismaClient();

function parseEmails(value?: string): string[] {
  return (value ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

async function main() {
  // Facultad de Ingeniería
  const faculty = await prisma.faculty.upsert({
    where: { id: 1 },
    update: {},
    create: { name: 'Facultad de Ingeniería', acronym: 'FI' },
  });

  // Escuelas profesionales base
  const schools = [
    'Ingeniería de Sistemas',
    'Ingeniería Ambiental',
    'Ingeniería Agroindustrial',
  ];
  for (const name of schools) {
    const exists = await prisma.professionalSchool.findFirst({
      where: { name, facultyId: faculty.id },
    });
    if (!exists) {
      await prisma.professionalSchool.create({
        data: { name, facultyId: faculty.id },
      });
    }
  }

  // Cuentas elevadas iniciales
  for (const email of parseEmails(process.env.OWNER_EMAILS)) {
    await prisma.user.upsert({
      where: { email },
      update: { role: Role.OWNER_SYSTEM },
      create: {
        email,
        fullName: email.split('@')[0],
        role: Role.OWNER_SYSTEM,
        facultyId: faculty.id,
      },
    });
  }
  for (const email of parseEmails(process.env.ADMIN_EMAILS)) {
    await prisma.user.upsert({
      where: { email },
      update: { role: Role.ADMIN_SYSTEM },
      create: {
        email,
        fullName: email.split('@')[0],
        role: Role.ADMIN_SYSTEM,
        facultyId: faculty.id,
      },
    });
  }

  console.log('Seed completado');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
