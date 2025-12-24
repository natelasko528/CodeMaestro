import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { redirectUri, state } = body;

    // Mock OAuth URL generation
    const authUrl = `https://marketplace.gohighlevel.com/oauth/chooselocation?client_id=mock_client_id&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}&response_type=code&scope=locations.readonly contacts.write`;

    return NextResponse.json({
      authUrl,
      state,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to generate OAuth URL' },
      { status: 500 }
    );
  }
}
