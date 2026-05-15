import { FastifyRequest, FastifyReply } from 'fastify'
import { verifyToken } from './jwt'
import User from '../models/User'

export async function requireAuth(req: FastifyRequest, reply: FastifyReply) {
  const token = req.cookies?.champqr_token
  if (!token) return reply.code(401).send({ message: 'Unauthorized' })

  try {
    const { userId } = verifyToken(token)
    const user = await User.findById(userId).lean()
    if (!user) return reply.code(401).send({ message: 'Unauthorized' })
    ;(req as any).user = user
  } catch {
    return reply.code(401).send({ message: 'Unauthorized' })
  }
}
