const Book = require('./models/book')
const Author = require('./models/author')
const User = require('./models/user')

const resolvers = {
  Author: {
    bookCount: async (root) => Book.find({}).where('author', root.id).countDocuments()
  },
  Query: {
    bookCount: async () => Book.collection.countDocuments(),
    authorCount: async () => Author.collection.countDocuments(),
    allBooks: async (root, args) => {
      if (args.genre) {
        return Book.find({ genres: { $all: args.genre } }).populate('author')
      }
      return Book.find({}).populate('author')
    },
    allAuthors: async () => Author.find({}),
    me: (root, args, { currentUser }) => currentUser,
  },
  Mutation: {
    addBook: async (root, args, { currentUser }) => {
      const author = new Author({ name: args.author })

      if (!currentUser) {
        throw new GraphQLError('Not authenticated', {
          extensions: {
            code: 'BAD_USER_INPUT'
          }
        })
      }

      const authorInDb = await Author.findOne({ name: author.name })

      if (!authorInDb) {
        try {
          await author.save()
        } catch (error) {
          throw new GraphQLError('Saving author failed', {
            extensions: {
              code: 'BAD_USER_INPUT',
              invalidArgs: args.author
            }
          })
        }
      }

      const book = new Book({ ...args, author: authorInDb ? authorInDb._id : author._id })

      try {
        await book.save()
      } catch (error) {
        throw new GraphQLError('Saving book failed', {
          extensions: {
            code: 'BAD_USER_INPUT',
            invalidArgs: args.title
          }
        })
      }

      return book.populate('author')
    },
    editAuthor: async (root, args, { currentUser }) => {
      if (!currentUser) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'BAD_USER_INPUT' }
        })
      }

      return Author.findOneAndUpdate(
        { name: args.name },
        { born: args.setBornTo },
        { new: true }
      )
    },
    createUser: async (root, args) => {
      const { username, password, favoriteGenre } = args
      const passwordHash = await bcrypt.hash(password, 10)
      const user = new User({ username, passwordHash, favoriteGenre })

      try {
        await user.save()
      } catch (error) {
        throw new GraphQLError('Error creating user', {
          extensions: { code: 'BAD_USER_INPUT', error }
        })
      }

      return user
    },
    login: async (root, args) => {
      const user = await User.findOne({ username: args.username })

      if (!user || !(await bcrypt.compare(args.password, user.passwordHash))) {
        throw new GraphQLError('Wrong credentials', {
          extensions: { code: 'BAD_USER_INPUT', }
        })
      }

      const userForToken = {
        id: user._id,
        username: user.username
      }

      return { value: jwt.sign(userForToken, process.env.JWT_SECRET) }
    },
  },
}

module.exports = resolvers