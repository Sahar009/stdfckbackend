const errorMiddleware = (err, req, res, next) =>{
  const statusCode =res.statusCode ? res.statusCode : 500
  res.status(statusCode)
  res.json({
      message:err.message,
      stack:process.env.NODE_ENV === "production" ? err.stack :null
  })
}

module.exports = errorMiddleware;









// const errorHandlerMiddleware = (err, req, res) => {
//   return res
//     .status(500)
//     .json({
//       msg: err,
//       stack: process.env === "development" ? err.stack : null,
//     });
// };

// module.exports = errorHandlerMiddleware;
