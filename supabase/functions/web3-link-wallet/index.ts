import { JsonRpcProvider, getAddress, verifyMessage } from 'npm:ethers@6'
import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const { device_id, wallet_address, signature, message } = await req.json()

    if (!device_id || !wallet_address || !signature || !message) {
      return json({ error: 'Missing fields' }, 400)
    }

    const wallet = getAddress(wallet_address)
    const recovered = verifyMessage(message, signature)

    if (getAddress(recovered) !== wallet) {
      return json({ error: 'Invalid signature' }, 400)
    }

    if (!message.includes(device_id)) {
      return json({ error: 'Message does not match device' }, 400)
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: player, error: playerErr } = await supabase
      .from('players')
      .select('username')
      .eq('device_id', device_id)
      .single()

    if (playerErr || !player?.username) {
      return json({ error: 'Player not found' }, 400)
    }

    if (!message.includes(`Trainer: ${player.username}`)) {
      return json({ error: 'Message does not match trainer' }, 400)
    }

    const { data, error } = await supabase.rpc('finalize_wallet_link', {
      p_device_id: device_id,
      p_wallet_address: wallet,
    })

    if (error) return json({ error: error.message }, 400)
    return json({ ok: true, snapshot: data })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return json({ error: msg }, 400)
  }
})
