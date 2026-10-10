from rest_framework import status, generics, permissions, viewsets
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth.models import User
from .serializers import (
    RegisterSerializer, UserSerializer, ChangePasswordSerializer,
    BusinessSerializer, BusinessMemberSerializer
)
from .models import UserProfile, Business, BusinessMember
from .utils import get_user_business

class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    permission_classes = (permissions.AllowAny,)
    serializer_class = RegisterSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        refresh = RefreshToken.for_user(user)
        user_data = UserSerializer(user).data
        return Response({
            'user': user_data,
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'message': 'User registered successfully.'
        }, status=status.HTTP_201_CREATED)

class UserProfileView(generics.RetrieveUpdateAPIView):
    permission_classes = (permissions.IsAuthenticated,)
    serializer_class = UserSerializer

    def get_object(self):
        # Ensure user profile & active business exist
        get_user_business(self.request.user)
        return self.request.user

class BusinessView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        business = get_user_business(request.user)
        if not business:
            return Response({'error': 'No active business context found.'}, status=status.HTTP_404_NOT_FOUND)
        serializer = BusinessSerializer(business)
        return Response(serializer.data)

    def put(self, request):
        business = get_user_business(request.user)
        if not business:
            return Response({'error': 'No active business context found.'}, status=status.HTTP_404_NOT_FOUND)
        serializer = BusinessSerializer(business, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

class BusinessMembersView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        business = get_user_business(request.user)
        members = BusinessMember.objects.filter(business=business, is_active=True)
        serializer = BusinessMemberSerializer(members, many=True)
        return Response(serializer.data)

class ChangePasswordView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            user = request.user
            user.set_password(serializer.validated_data['new_password'])
            user.save()
            return Response({'message': 'Password updated successfully.'}, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
