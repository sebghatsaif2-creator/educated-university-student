'use strict';

const express = require('express');
const {
  listUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
} = require('../controllers/userController');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { idParamSchema } = require('../validators/common');
const {
  listUsersQuerySchema,
  createUserBodySchema,
  updateUserBodySchema,
} = require('../validators/adminValidators');

const router = express.Router();

router.use(authenticate, authorize('admin'));

router.get('/', validate({ query: listUsersQuerySchema }), listUsers);
router.get('/:id', validate({ params: idParamSchema }), getUserById);
router.post('/', validate({ body: createUserBodySchema }), createUser);
router.patch('/:id', validate({ params: idParamSchema, body: updateUserBodySchema }), updateUser);
router.put('/:id', validate({ params: idParamSchema, body: updateUserBodySchema }), updateUser);
router.delete('/:id', validate({ params: idParamSchema }), deleteUser);

module.exports = router;
