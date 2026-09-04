import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { CustomerMemoryUpdater } from '@/lib/ml/learning/customer-memory-updater';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: customerId } = await params;

    let profile: any = null;
    if (process.env.SKIP_DB !== 'true') {
      try {
        profile = await prisma.customerRecoveryProfile.findUnique({
          where: { customerId },
          include: { customer: true },
        });
      } catch {
        // resilient
      }
    }

    if (!profile) {
      profile = CustomerMemoryUpdater.getMemory(customerId);
    }

    if (!profile) {
      return NextResponse.json(
        { success: false, error: `Customer memory not found for id ${customerId}` },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      customerId,
      memory: profile,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to retrieve customer memory' },
      { status: 500 }
    );
  }
}
