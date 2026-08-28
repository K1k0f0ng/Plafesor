import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import axios from 'axios';
import Login from './Login';
import { AuthProvider } from '../context/AuthContext';

jest.mock('axios');

function renderLogin() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <Login />
      </AuthProvider>
    </MemoryRouter>
  );
}

describe('Login', () => {
  test('muestra el formulario con los campos de correo y contraseña', () => {
    renderLogin();
    expect(screen.getByPlaceholderText('usuario@correo.com')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ingresar' })).toBeInTheDocument();
  });

  test('muestra un mensaje de error si el login falla', async () => {
    axios.post.mockRejectedValueOnce({ response: { data: { error: 'Credenciales incorrectas' } } });
    renderLogin();

    fireEvent.change(screen.getByPlaceholderText('usuario@correo.com'), { target: { value: 'test@correo.com' } });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'clave123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ingresar' }));

    await waitFor(() => {
      expect(screen.getByText('Credenciales incorrectas')).toBeInTheDocument();
    });
  });
});
