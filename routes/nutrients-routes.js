//Imports express npm
const express = require('express');

//calls the express.router method
const router = express.Router();

const db = require('../models');
const axios = require('axios');

//This route will return all the nutrients available in the nutrients table
router.get('/api/nutrientCodes', function (req, res) {
  db.Nutrients.findAll({}).then(function (dbNutrients) {
    console.log('inside get response');

    res.json(dbNutrients);
  });
});
//This route will return all the health options available in the nutrients table
router.get('/api/healthCodes', function (req, res) {

  db.Health.findAll({ attributes: ['healthApiCode'] }).then(function (dbHealth) {

    console.log('inside get response');

    res.json(dbHealth);
  });
});

router.get('/api/nutrients/:userEmail/:nutrients/:healthCode', function (req, res) {
  console.log(
    req.params.userEmail + 'has searched for ' + req.params.nutrients + ' & ' + req.params.healthCode
  );

  // const userEmail = req.params

  const queryURL = `https://api.edamam.com/search?q=chicken&app_id=08b4fa57&app_key=8531f8a5f6847b98f73396ab5968aed9&nutrients%5B${req.params.nutrients}%5D=20%2B&health=${req.params.healthCode}`;

  db.Searches.findOne({
    where: {
      searchQuery: queryURL
    }
  }).then(function (dbSearchExist) {
    //If SQL query doesn't not find a search
    if (!dbSearchExist) {
      console.log('if');
      //The search is saved into our database as a new search
      db.Searches.create({
        searchQuery: queryURL,
        NutrientCode: req.params.nutrients,
        HealthApiCode: req.params.healthCode
      }).then(function (newSearch) {
        console.log('past search create');

        //Perform an axios call to Edamam based on query url specified above
        axios.get(queryURL).then(function (apiRecipes) {
          //The resp obj from the api has a setup that requires to navigate to .data then .hits inorder to get the array of recpe objects
          const recipesApiArr = apiRecipes.data.hits;

          //Custom function that grabs the array of recipes returned fro maxios call and creates an array of objects from them
          //The object is specified by variable obj.  This obj matches the columns for recipes table
          //That way the obj can be placed in array by map() method and then that array can be used to bulk insert recipes
          const createArr = recipesApiArr.map(recipes => {
            const obj = {
              searchQuery: queryURL,
              label: recipes.recipe.label,
              url: recipes.recipe.url,
              img: recipes.recipe.image,
              ingredientLines: recipes.recipe.ingredientLines,
              //This is a rather large array of objects that we do not use all the info from
              //Therefore the data is set to an array of objects grabs the data we want from the api so it can be saved in database.
              //Digest was chosen because it matches the external api naming convention
              digest: recipes.recipe.digest.map(nutrientDataArr => {
                const nutrientObj = {
                  label: nutrientDataArr.label,
                  total: nutrientDataArr.total,
                  daily: nutrientDataArr.daily,
                  unit: nutrientDataArr.unit
                };
                return nutrientObj;
              })
            };
            return obj;
          });

          //This group of code takes the above array of objects and does a bulkInsert into the recipes table.
          //Since the objects were formated above to match table columns array can be inserted as parameter
          db.Recipes.bulkCreate(createArr).then(function (createdRecipes) {
            //addRecipes is a method automatically generated by sequelize through the associations made in models folder
            //see https://sequelize.org/v3/api/associations/belongs-to-many/
            newSearch
              .addRecipes(createdRecipes)
              .then(function (resp) {

                const recipeData = resp.map(Recipe =>
                  Recipe.get({ plain: true })
                );

                // console.log(recipeData);

                const updatedCreateArr = createArr.map((RecipesToAdd , indexOfRecipeData) => {
                  const justAddedRecipeFromDB = recipeData[indexOfRecipeData]; 
                  
                  console.log(justAddedRecipeFromDB.RecipeId);
                  RecipesToAdd.id = justAddedRecipeFromDB.RecipeId;
                  return RecipesToAdd;
                }
                );

                console.log(updatedCreateArr);

                //Now that recipes have been saved to database they can be rendered into a html string with handlebars
                //Then send back to the frontend
                res.render('recipes', {
                  layout: 'main.handlebars',
                  recipe: createArr
                });
              })
              .catch(error => {
                console.error(error);
              });
          });
        });
      });
    }
    //If SQL query finds a search
    else {
      console.log('else');
      const foundSearchId = dbSearchExist.dataValues.id;

      //This line of code looks through the search that matches the one that user just executed.
      //It then uses the association between it an recipes and brings back all the recipes associated with that search
      db.Searches.findOne({
        where: { id: foundSearchId },
        include: { model: db.Recipes }
      })
        .then(function (dbRecipes) {
          const recipeData = dbRecipes.dataValues.Recipes.map(Recipe =>
            Recipe.get({ plain: true })
          );

          //The handles bars for recipes from database is slightly different because of format of api object
          res.render('recipes', {
            layout: 'main.handlebars',
            recipe: recipeData
          });
        })
        .catch(err => {
          console.log(err);
        });
    }
  });
});

router.put('/saveRecipe/:userEmail/:recipeId', function (req, res) {
  console.log('entered save recipe to user');
  console.log(req.params.userEmail);
  console.log(req.params.recipeId);

  db.User.findOne({ where: { email: req.params.userEmail } }).then(function (
    savingUser
  ) {
    savingUser
      .addRecipe([req.params.recipeId])
      .then(function (likeRecipe) {
        console.log('entered .then of add association');
        console.log(likeRecipe);
        res.json(likeRecipe);
      })
      .catch(err => {
        console.log(err);
      });
  });
});

router.get('/api/recipes', function (req, res) {
  console.log('***************  api recipes');
  db.Recipes.findAll({}).then(function (dbRecipes) {
    res.json(dbRecipes);
  });
});

//This is to return all the recipes a user has saved
router.get('/recipes/:userEmail', function (req, res) {
  db.User.getRecipes({ where: { email: req.params.userEmail } }).then(function (
    dbuserRecipes
  ) {
    res.json(dbuserRecipes);
  });
});

//This is to return all the searches
router.get('/searches/:userEmail', function (req /*, res*/) {
  // eslint-disable-next-line
  db.User.getRecipes({ where: { email: req.params.userEmail } }).then(function () {

  });
});

//This is to return all recipes for the search

module.exports = router;

//saved code that was used in axios call in previous set-up
// Used for rendering recipe html string straight from api call response without the bulkCreate
//_______________________________________
//   .catch(function(err) {
//     res.status(401).json(err);
//   });
// console.log('in axios');
// console.log(apiRecipes.data.hits);
// const recipes = {
//   layout: false,
//   recipe: apiRecipes.data.hits
// }
// console.log('in axios2');

// res.render('recipes', recipes, function(err, html) {
//   if(err) {
//     throw err
//   } else {

//   res.send(html);
//   // console.log(html);
//   }
//

// //Now that recipes have been saved to database they can be rendered into a html string with handlebars
//Then send back to the frontend
//   res.render('recipes', { layout: false, recipe: recipesApiArr });
// }).catch(error => {
//   console.error(error)
