const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

const app = express();
app.use(express.json());
const dbPath = path.join(__dirname, "twitterClone.db");

let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000");
    });
  } catch (e) {
    console.log(`DBError: ${e.message}`);
    process.exit(1);
  }
};

initializeDBAndServer();

//

const authenticateToken = async (request, response, next) => {
  let jwtToken;
  const authorHeader = request.headers["authorization"];
  if (authorHeader === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  }
  if (authorHeader !== undefined) {
    jwtToken = authorHeader.split(" ")[1];
    if (jwtToken === undefined) {
      response.status(401);
      response.send("Invalid JWT Token");
    } else {
      jwt.verify(jwtToken, "kajfge_jiahfieh_fahf", async (error, payload) => {
        if (error) {
          response.status(401);
          response.send("Invalid JWT Token");
        } else {
          request.payload = payload;
          next();
        }
      });
    }
  }
};

//

// User Register API-1

app.post("/register/", async (request, response) => {
  const { username, password, name, gender } = request.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  selectUserQuery = `
        SELECT * FROM user WHERE username = '${username}';
    `;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser !== undefined) {
    dbUser;
    response.status(400);
    response.send("User already exists");
  } else {
    if (password.length < 6) {
      response.status(400);
      response.send("Password is too short");
    } else {
      const createUserQuery = `
            INSERT INTO user(username, password, name, gender)
            VALUES(
                '${username}',
                '${hashedPassword}',
                '${name}',
                '${gender}'
            );
        `;
      await db.run(createUserQuery);
      response.send("User created successfully");
    }
  }
});

// Login User API-2

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'; `;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const jwtToken = jwt.sign(dbUser, "kajfge_jiahfieh_fahf");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

// Get Tweets of user follows API-3

app.get("/user/tweets/feed/", authenticateToken, async (request, response) => {
  const { user_id, username, name, gender } = request.payload;
  const selectTweetFeeds = `
  SELECT user.username,
         tweet.tweet,
         tweet.date_time AS dateTime
  FROM
     follower INNER JOIN tweet ON follower.following_user_id = tweet.user_id INNER JOIN user ON user.user_id = follower.following_user_id
  WHERE 
      follower.follower_user_id = ${user_id}
  ORDER BY date_time DESC
  LIMIT 4;
  `;
  getTweetFeedDetails = await db.all(selectTweetFeeds);
  response.send(getTweetFeedDetails);
});

// Get Following Users API-4

app.get("/user/following/", authenticateToken, async (request, response) => {
  const { user_id, username, name, gender } = request.payload;
  const selectUserFollowingQuery = `
        SELECT user.name
        FROM user INNER JOIN follower ON user.user_id = follower.following_user_id
        WHERE follower.follower_user_id = ${user_id};
    `;
  const getFollowingNames = await db.all(selectUserFollowingQuery);
  response.send(getFollowingNames);
});

// Get User Followers API-5

app.get("/user/followers/", authenticateToken, async (request, response) => {
  const { user_id, username, name, gender } = request.payload;
  const selectFollowersQuery = `
         SELECT user.name
         FROM follower INNER JOIN user ON user.user_id = follower.follower_user_id
         WHERE follower.following_user_id = ${user_id};
    `;
  const getFollowers = await db.all(selectFollowersQuery);
  response.send(getFollowers);
});

// Get Info about a Tweet API-6

app.get("/tweets/:tweetId", authenticateToken, async (request, response) => {
  const { user_id, username, name, gender } = request.payload;
  const { tweetId } = request.params;
  const selectTweetQuery = `
    SELECT * FROM tweet WHERE tweet_id = ${tweetId};
  `;
  const tweetResDetails = await db.get(selectTweetQuery);
  //   console.log(tweetResDetails);
  const selectFollowingUsersQuery = `
        SELECT *
        FROM user INNER JOIN follower ON user.user_id = follower.following_user_id
        WHERE follower.follower_user_id = ${user_id}
        ;
    `;
  const getFollowingIds = await db.all(selectFollowingUsersQuery);
  //   console.log(getFollowingIds);
  if (
    getFollowingIds.some(
      (eachObj) => eachObj.following_user_id === tweetResDetails.user_id
    )
  ) {
    const getTweetDetailsQuery = `
        SELECT tweet.tweet AS tweet,
                COUNT(DISTINCT(like.like_id)) AS likes,
                COUNT(DISTINCT(reply.reply_id)) AS replies,
                tweet.date_time AS dateTime
        FROM tweet INNER JOIN like ON tweet.tweet_id = like.tweet_id INNER JOIN reply ON reply.tweet_id = tweet.tweet_id
        WHERE tweet.tweet_id = ${tweetId};
    `;
    const getTweetDetails = await db.get(getTweetDetailsQuery);
    response.send(getTweetDetails);
  } else {
    response.status(401);
    response.send("Invalid Request");
  }
});

// Get Likes of Tweet API-7

app.get(
  "/tweets/:tweetId/likes/",
  authenticateToken,
  async (request, response) => {
    const { user_id, username, name, gender } = request.payload;
    const { tweetId } = request.params;
    const selectTweetQuery = `
        SELECT * FROM tweet WHERE tweet_id = ${tweetId};
    `;
    const tweetResultDet = await db.get(selectTweetQuery);
    // console.log(tweetResultDet);
    const selectFollwingUsersIdsQuery = `
        SELECT * FROM user INNER JOIN follower ON user.user_id = follower.following_user_id
        WHERE follower.follower_user_id = ${user_id};
    `;
    const getFollowerDetails = await db.all(selectFollwingUsersIdsQuery);
    // console.log(getFollowerDetails);
    if (
      getFollowerDetails.some(
        (eachObj) => tweetResultDet.user_id === eachObj.following_user_id
      )
    ) {
      const getListOfUsersLikeQuery = `
            SELECT DISTINCT(user.username)
            FROM like INNER JOIN tweet ON tweet.tweet_id = like.tweet_id INNER JOIN user ON user.user_id = like.user_id
            WHERE tweet.tweet_id = ${tweetId};
        `;
      const getListOfUsersLiked = await db.all(getListOfUsersLikeQuery);

      const usersList = getListOfUsersLiked.map((eachObj) => {
        return eachObj.username;
      });
      //   console.log(usersList);
      response.send({ likes: usersList });
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);

// Get replies of a tweet API-8

app.get(
  "/tweets/:tweetId/replies/",
  authenticateToken,
  async (request, response) => {
    const { user_id, username, name, gender } = request.payload;
    const { tweetId } = request.params;
    const selectTweetQuery = `
        SELECT * FROM tweet WHERE tweet_id = ${tweetId};
    `;
    const tweetResultDet = await db.get(selectTweetQuery);
    // console.log(tweetResultDet);
    const selectFollwingUsersIdsQuery = `
        SELECT * FROM user INNER JOIN follower ON user.user_id = follower.following_user_id
        WHERE follower.follower_user_id = ${user_id};
    `;
    const getFollowerDetails = await db.all(selectFollwingUsersIdsQuery);
    // console.log(getFollowerDetails);
    if (
      getFollowerDetails.some(
        (eachObj) => tweetResultDet.user_id === eachObj.following_user_id
      )
    ) {
      const getListOfrepliesQuery = `
            SELECT user.name AS name,
                    reply.reply AS reply
            FROM reply INNER JOIN tweet ON tweet.tweet_id = reply.tweet_id INNER JOIN user ON user.user_id = reply.user_id
            WHERE tweet.tweet_id = ${tweetId};
        `;
      const getListOfreplies = await db.all(getListOfrepliesQuery);
      //   console.log(getListOfreplies);
      response.send({ replies: getListOfreplies });
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);

// Get User Tweets API-9

app.get("/user/tweets/", authenticateToken, async (request, response) => {
  const { user_id, username, gender, name } = request.payload;
  //   console.log(user_id);
  const selectTweetDetailsQuery = `
        SELECT tweet.tweet,
                COUNT(DISTINCT(like.like_id)) AS likes,
                COUNT(DISTINCT(reply.reply_id)) AS replies,
                tweet.date_time AS dateTime
        FROM user INNER JOIN tweet ON user.user_id = tweet.user_id INNER JOIN like ON like.tweet_id = tweet.tweet_id INNER JOIN reply ON reply.tweet_id = tweet.tweet_id
        WHERE user.user_id = ${user_id}
        GROUP BY tweet.tweet_id;
    `;
  const getTweetDetailsOfUser = await db.all(selectTweetDetailsQuery);
  response.send(getTweetDetailsOfUser);
});

// Create a Tweet API-10

app.post("/user/tweets/", authenticateToken, async (request, response) => {
  const { user_id, username, name, length } = request.payload;
  const { tweet } = request.body;
  const createTweetByIdQuery = `
        INSERT INTO tweet(tweet, user_id)
        VALUES(
            '${tweet}',
            ${user_id}
        );
    `;
  await db.run(createTweetByIdQuery);
  response.send("Created a Tweet");
});

// Delete User Tweet API-11

app.delete(
  "/tweets/:tweetId/",
  authenticateToken,
  async (request, response) => {
    const { tweetId } = request.params;
    const { user_id, username, name, gender } = request.payload;
    const selectUserTweetsQuery = `
        SELECT * FROM tweet WHERE tweet_id = ${tweetId};
    `;
    const getTweetResult = await db.all(selectUserTweetsQuery);
    if (getTweetResult.some((eachObj) => eachObj.user_id === user_id)) {
      const deleteUserTweetQuery = `
            DELETE FROM tweet
            WHERE user_id = ${user_id};
        `;
      await db.run(deleteUserTweetQuery);
      response.send("Tweet Removed");
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);

module.exports = app;
