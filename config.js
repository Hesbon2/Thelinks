module.exports = {
    MONGODB_URI: process.env.MONGODB_URI || 'mongodb+srv://hesbonmakori15:Audrey1996@cluster0.jqn4peu.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0',
    JWT_SECRET: process.env.JWT_SECRET || '647b7a084b50d61d33588e82d03b4bb0d05bd6f26e5332bc252b528a5dd827f9113701a223bfdd65d11499b5daa2d2474e5ccfa753147d3a3884f88e8b16bb7a',
    PORT: process.env.PORT || 3000,
    API_URL: process.env.NODE_ENV === 'production' 
        ? process.env.API_URL 
        : 'https://thelinks-gray.vercel.app/api'
}; 