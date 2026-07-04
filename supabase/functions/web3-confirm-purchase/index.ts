import { JsonRpcProvider, getAddress } from 'npm:ethers@6'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { getBscConfig } from '../_shared/bsc.ts'

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
    const { device_id, order_id, tx_hash } = await req.json()

    if (!device_id || !order_id || !tx_hash) {
      return json({ error: 'Missing fields' }, 400)
    }

    const bsc = getBscConfig()
    const provider = new JsonRpcProvider(bsc.rpcUrl, bsc.chainId)
    const tx = await provider.getTransaction(tx_hash)
    if (!tx) return json({ error: 'Transaction not found' }, 400)

    const receipt = await provider.getTransactionReceipt(tx_hash)
    if (!receipt || receipt.status !== 1) {
      return json({ error: 'Transaction not confirmed' }, 400)
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: orderRow, error: orderErr } = await supabase
      .from('crypto_orders')
      .select('amount_wei, treasury_address, player_id')
      .eq('id', order_id)
      .single()

    if (orderErr || !orderRow) return json({ error: 'Order not found' }, 400)

    const { data: player, error: playerErr } = await supabase
      .from('players')
      .select('device_id, wallet_address')
      .eq('id', orderRow.player_id)
      .single()

    if (playerErr || !player) return json({ error: 'Player not found' }, 400)
    if (player.device_id !== device_id) return json({ error: 'Order mismatch' }, 400)

    const fromWallet = getAddress(tx.from)
    const linkedWallet = getAddress(player.wallet_address)
    const toWallet = getAddress(tx.to ?? '')
    const treasury = getAddress(orderRow.treasury_address as string)

    if (fromWallet !== linkedWallet) return json({ error: 'Wrong sender wallet' }, 400)
    if (toWallet !== treasury) return json({ error: 'Wrong recipient' }, 400)
    if (tx.value.toString() !== String(orderRow.amount_wei)) {
      return json({ error: 'Wrong payment amount' }, 400)
    }

    const { data, error } = await supabase.rpc('finalize_crypto_order', {
      p_order_id: order_id,
      p_tx_hash: tx_hash,
      p_from_wallet: fromWallet,
      p_to_wallet: toWallet,
      p_value_wei: tx.value.toString(),
    })

    if (error) return json({ error: error.message }, 400)
    return json({ ok: true, snapshot: data })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return json({ error: msg }, 400)
  }
})
