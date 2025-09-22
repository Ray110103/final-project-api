import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as GitHubStrategy } from 'passport-github2';

console.log('Setting up Passport strategies...');

passport.use(
  'google',
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      callbackURL: "http://localhost:8000/auth/google/callback", // Harus persis sama
    },
    async (accessToken, refreshToken, profile, done) => {
      console.log('Google strategy called');
      try {
        return done(null, profile);
      } catch (error) {
        return done(error, false);
      }
    }
  )
);

passport.use(
  'github',
  new GitHubStrategy(
    {
      clientID: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      callbackURL: "http://localhost:8000/auth/github/callback", // Harus sama persis
    },
    async (accessToken: string, refreshToken: string, profile: any, done: any) => {
      console.log('GitHub strategy called with profile:', {
        id: profile.id,
        username: profile.username,
        email: profile.emails?.[0]?.value
      });
      
      try {
        return done(null, profile);
      } catch (error) {
        console.error('GitHub strategy error:', error);
        return done(error, false);
      }
    }
  )
);